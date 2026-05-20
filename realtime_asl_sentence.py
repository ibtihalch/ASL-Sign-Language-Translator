"""
Real-time ASL Gesture -> Sentence
──────────────────────────────────
Usage:
  python realtime_asl_sentence.py                    # webcam
  python realtime_asl_sentence.py path/to/video.mp4 # video file

Controls:
  Q     = quit
  C     = clear sentence
  SPACE = force commit current prediction
"""

import json
import sys
import time
import urllib.request
from collections import deque
from pathlib import Path
import pickle

import cv2
import mediapipe as mp
import numpy as np
import tensorflow as tf
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

# ─────────────────────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────────────────────
BUFFER_SIZE         = 20
INFER_EVERY         = 10
STILL_THRESHOLD     = 0.015
STILL_FRAMES_NEEDED = 6
MIN_CONFIDENCE      = 0.28
MAX_SENTENCE_WORDS  = 12
NO_HAND_RESET_FRAMES = 2
RAPID_CONFIDENCE = 0.72
RAPID_STREAK_NEEDED = 3
COMMIT_COOLDOWN_SEC = 0.45

MODEL_DIR = Path(__file__).resolve().parent / "backend" / "model"

HAND_TASK_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
)
POSE_TASK_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
)

# ─────────────────────────────────────────────────────────────
#  AUTO-DOWNLOAD .task files if missing
# ─────────────────────────────────────────────────────────────
def maybe_download(path: Path, url: str) -> None:
    if not path.exists():
        print(f"Downloading {path.name} ...")
        urllib.request.urlretrieve(url, path)
        print(f"  ✅ {path.name} downloaded")

maybe_download(MODEL_DIR / "hand_landmarker.task", HAND_TASK_URL)
maybe_download(MODEL_DIR / "pose_landmarker.task",  POSE_TASK_URL)

# ─────────────────────────────────────────────────────────────
#  LOAD MAPPING
# ─────────────────────────────────────────────────────────────
with open(MODEL_DIR / "mapping.json", encoding="utf-8") as f:
    raw = json.load(f)

if "index_to_word" in raw:
    idx_to_word = {int(k): v for k, v in raw["index_to_word"].items()}
elif "selected_words" in raw:
    idx_to_word = {i: w for i, w in enumerate(raw["selected_words"])}
elif "word_to_index" in raw:
    idx_to_word = {int(v): k for k, v in raw["word_to_index"].items()}
else:
    idx_to_word = {int(k): v for k, v in raw.items()}

NUM_CLASSES = len(idx_to_word)
print(f"✅ Mapping loaded — {NUM_CLASSES} words")
print(f"   Words: {sorted(idx_to_word.values())}")

# ─────────────────────────────────────────────────────────────
#  BUILD MODEL + LOAD WEIGHTS
# ─────────────────────────────────────────────────────────────
def build_model(num_classes: int) -> tf.keras.Model:
    inputs = tf.keras.Input(shape=(20, 225))
    x = tf.keras.layers.LayerNormalization()(inputs)
    x = tf.keras.layers.Bidirectional(
            tf.keras.layers.LSTM(128, return_sequences=True))(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    x = tf.keras.layers.Bidirectional(
            tf.keras.layers.LSTM(64, return_sequences=False))(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    x = tf.keras.layers.Dense(256, activation="relu")(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.4)(x)
    x = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    return tf.keras.Model(inputs, x)

print("Loading model weights...")
model = build_model(NUM_CLASSES)
with open(str(MODEL_DIR / "model_weights.pkl"), "rb") as f:
    weights = pickle.load(f)
model.set_weights(weights)
print("  ✅ Model ready")

# ─────────────────────────────────────────────────────────────
#  LANDMARK NORMALIZATION (must match training exactly)
# ─────────────────────────────────────────────────────────────
def normalize_frame(features: np.ndarray) -> np.ndarray:
    out = features.copy()
    lh = out[0:63].reshape(21, 3)
    if np.any(lh != 0):
        lh = lh - lh[0]
        s  = np.max(np.linalg.norm(lh, axis=1)) + 1e-8
        out[0:63] = (lh / s).flatten()
    rh = out[63:126].reshape(21, 3)
    if np.any(rh != 0):
        rh = rh - rh[0]
        s  = np.max(np.linalg.norm(rh, axis=1)) + 1e-8
        out[63:126] = (rh / s).flatten()
    pose = out[126:225].reshape(33, 3)
    if np.any(pose != 0):
        pose = pose - pose[0]
        sw   = np.linalg.norm(pose[11] - pose[12]) + 1e-8
        out[126:225] = (pose / sw).flatten()
    return out.astype(np.float32)

# ─────────────────────────────────────────────────────────────
#  EXTRACT FEATURES
# ─────────────────────────────────────────────────────────────
def extract_features(hand_res, pose_res) -> np.ndarray:
    feat = np.zeros(225, dtype=np.float32)
    lh   = np.zeros((21, 3), dtype=np.float32)
    rh   = np.zeros((21, 3), dtype=np.float32)
    if hand_res and hand_res.hand_landmarks:
        for i, landmarks in enumerate(hand_res.hand_landmarks):
            xyz  = np.array([[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32)
            side = None
            if hand_res.handedness and i < len(hand_res.handedness):
                side = hand_res.handedness[i][0].category_name.lower()
            if side == "left":    lh = xyz
            elif side == "right": rh = xyz
            else:
                if not np.any(lh): lh = xyz
                elif not np.any(rh): rh = xyz
    if pose_res and pose_res.pose_landmarks:
        pose = np.array([[lm.x, lm.y, lm.z]
                         for lm in pose_res.pose_landmarks[0]], dtype=np.float32)
        feat[126:225] = pose.flatten()
    feat[0:63]   = lh.flatten()
    feat[63:126] = rh.flatten()
    return feat

# ─────────────────────────────────────────────────────────────
#  DRAW HAND DOTS
# ─────────────────────────────────────────────────────────────
def draw_hands(frame: np.ndarray, hand_res) -> None:
    if not hand_res or not hand_res.hand_landmarks:
        return
    h, w = frame.shape[:2]
    for hand in hand_res.hand_landmarks:
        for lm in hand:
            x, y = int(lm.x * w), int(lm.y * h)
            if 0 <= x < w and 0 <= y < h:
                cv2.circle(frame, (x, y), 4, (0, 255, 0), -1)

# ─────────────────────────────────────────────────────────────
#  DRAW UI
# ─────────────────────────────────────────────────────────────
def draw_ui(frame, sentence, top3, still_count, buf_len, is_video):
    h, w   = frame.shape[:2]
    TOP    = 155
    BOTTOM = 85
    canvas = np.zeros((h + TOP + BOTTOM, w, 3), dtype=np.uint8)
    canvas[TOP:TOP + h, :] = frame

    label = f"{top3[0][0].upper()}  ({top3[0][1]*100:.1f}%)" if top3 else "Filling buffer..."
    cv2.putText(canvas, label, (20, 45),
                cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 2, cv2.LINE_AA)

    mode_text  = "MODE: VIDEO FILE" if is_video else "MODE: WEBCAM"
    mode_color = (0, 200, 255) if is_video else (0, 255, 128)
    cv2.putText(canvas, mode_text, (20, 80),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, mode_color, 2)
    cv2.putText(canvas, f"buf: {buf_len}/{BUFFER_SIZE}", (280, 80),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 180), 2)

    cv2.putText(canvas, "Top-3:", (20, 110),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)
    for i, (word, conf) in enumerate(top3):
        cv2.putText(canvas, f"{i+1}. {word}: {conf*100:.1f}%",
                    (110, 110 + i * 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (230, 230, 230), 1, cv2.LINE_AA)

    BAR_W = 220
    bx    = w - BAR_W - 20
    by    = 28
    prog  = min(still_count, STILL_FRAMES_NEEDED) / STILL_FRAMES_NEEDED
    fill  = int(prog * BAR_W)
    color = (0, 255, 128) if prog >= 1.0 else (0, 200, 255)
    cv2.putText(canvas,
                f"Stillness {min(still_count, STILL_FRAMES_NEEDED)}/{STILL_FRAMES_NEEDED}",
                (bx, by - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (200, 200, 200), 1)
    cv2.rectangle(canvas, (bx, by), (bx + BAR_W, by + 18), (80, 80, 80), 2)
    if fill > 0:
        cv2.rectangle(canvas, (bx, by), (bx + fill, by + 18), color, -1)

    base = TOP + h
    cv2.rectangle(canvas, (0, base), (w, base + BOTTOM), (20, 20, 20), -1)
    cv2.putText(canvas, "Sentence:", (15, base + 32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2, cv2.LINE_AA)
    sentence_str = " ".join(sentence) if sentence else "..."
    font_scale   = 0.85
    (tw, _), _   = cv2.getTextSize(sentence_str, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 2)
    while tw > w - 170 and len(sentence_str) > 3:
        sentence_str = "... " + " ".join(sentence_str.split()[1:])
        (tw, _), _   = cv2.getTextSize(sentence_str, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 2)
    cv2.putText(canvas, sentence_str, (165, base + 32),
                cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(canvas, "Q: Quit   C: Clear   SPACE: Force commit",
                (15, base + 65),
                cv2.FONT_HERSHEY_SIMPLEX, 0.52, (150, 150, 150), 1)

    return canvas

# ─────────────────────────────────────────────────────────────
#  VIDEO INFERENCE (same as training: 20 evenly-spaced frames)
# ─────────────────────────────────────────────────────────────
def predict_video(video_path, hand_det, pose_det):
    """
    Extracts 20 evenly-spaced frames from the video — exactly like training.
    Returns top3 list of (word, confidence).
    """
    cap   = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total < 2:
        cap.release()
        return []

    indices = np.linspace(0, total - 1, BUFFER_SIZE, dtype=int)
    seq     = []

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ret, frame = cap.read()
        if not ret:
            seq.append(np.zeros(225, dtype=np.float32))
            continue
        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        try:
            hr   = hand_det.detect(mp_img)
            pr   = pose_det.detect(mp_img)
            raw  = extract_features(hr, pr)
            norm = normalize_frame(raw)
            seq.append(norm)
        except Exception:
            seq.append(np.zeros(225, dtype=np.float32))

    cap.release()

    seq_arr = np.array(seq, dtype=np.float32)[np.newaxis]  # (1, 20, 225)
    pred    = model.predict(seq_arr, verbose=0)[0]
    idx3    = np.argsort(pred)[::-1][:3]
    return [(idx_to_word.get(int(i), "?"), float(pred[i])) for i in idx3]

# ─────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) > 1:
        video_source = sys.argv[1]
        is_video     = True
        print(f"\n📹 Video mode: {video_source}")
    else:
        video_source = 0
        is_video     = False
        print("\n📷 Webcam mode")

    hand_opts = mp_vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(
            model_asset_path=str(MODEL_DIR / "hand_landmarker.task")),
        running_mode=mp_vision.RunningMode.IMAGE,
        num_hands=2,
    )
    pose_opts = mp_vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(
            model_asset_path=str(MODEL_DIR / "pose_landmarker.task")),
        running_mode=mp_vision.RunningMode.IMAGE,
    )

    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open: {video_source}")

    buffer      = deque(maxlen=BUFFER_SIZE)
    sentence    = []
    last_word   = ""
    still_count = 0
    no_hand_frames = 0
    rapid_word = ""
    rapid_streak = 0
    last_commit_ts = 0.0
    frame_idx   = 0
    top3        = []

    print("   Sign a word -> hold still -> word commits to sentence")
    print("   Q=quit  C=clear  SPACE=force commit\n")

    with (mp_vision.HandLandmarker.create_from_options(hand_opts) as hand_det,
          mp_vision.PoseLandmarker.create_from_options(pose_opts) as pose_det):

        # ── VIDEO MODE: predict like training FIRST ───────────
        if is_video:
            print("Analyzing video (20 evenly-spaced frames)...")
            top3_video = predict_video(video_source, hand_det, pose_det)
            print(f"\n{'='*35}")
            print(f"VIDEO PREDICTION:")
            for rank, (word, conf) in enumerate(top3_video):
                bar = '█' * int(conf * 20)
                print(f"  #{rank+1}: {word:15} {conf*100:5.1f}%  {bar}")
            print(f"{'='*35}\n")
            # Pre-fill top3 so screen shows prediction immediately
            top3 = top3_video

        # ── MAIN LOOP ─────────────────────────────────────────
        while True:
            ok, frame = cap.read()
            if not ok:
                if is_video:
                    print("\nVideo ended.")
                break

            if not is_video:
                frame = cv2.flip(frame, 1)

            rgb     = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_img  = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

            hand_res = hand_det.detect(mp_img)
            pose_res = pose_det.detect(mp_img)
            hand_present = bool(hand_res and hand_res.hand_landmarks and len(hand_res.hand_landmarks) > 0)

            raw  = extract_features(hand_res, pose_res)
            norm = normalize_frame(raw)
            hand_mean = float(np.mean(np.abs(norm[:126])))
            if hand_present:
                no_hand_frames = 0
                buffer.append(norm)
                if hand_mean < STILL_THRESHOLD:
                    still_count += 1
                else:
                    still_count = 0
            else:
                no_hand_frames += 1
                still_count = 0
                rapid_word = ""
                rapid_streak = 0
                if no_hand_frames >= NO_HAND_RESET_FRAMES:
                    top3 = []
                    buffer.clear()

            frame_idx += 1
            inferred_now = False

            # VIDEO: re-run full inference every 30 frames
            # WEBCAM: rolling buffer inference every 10 frames
            if is_video:
                if frame_idx % 30 == 0:
                    top3 = predict_video(video_source, hand_det, pose_det)
            else:
                if hand_present and len(buffer) == BUFFER_SIZE and frame_idx % INFER_EVERY == 0:
                    seq  = np.array(buffer, dtype=np.float32)[np.newaxis]
                    pred = model.predict(seq, verbose=0)[0]
                    idx3 = np.argsort(pred)[::-1][:3]
                    top3 = [(idx_to_word.get(int(i), "?"), float(pred[i])) for i in idx3]
                    inferred_now = True

            if hand_present and inferred_now and top3:
                best_word, best_conf = top3[0]
                if best_conf >= RAPID_CONFIDENCE:
                    if best_word == rapid_word:
                        rapid_streak += 1
                    else:
                        rapid_word = best_word
                        rapid_streak = 1
                else:
                    rapid_word = ""
                    rapid_streak = 0

            if hand_present and top3:
                best_word, best_conf = top3[0]
                ready_by_still = (still_count >= STILL_FRAMES_NEEDED and best_conf >= MIN_CONFIDENCE)
                ready_by_rapid = (rapid_streak >= RAPID_STREAK_NEEDED and best_conf >= RAPID_CONFIDENCE)
                cooldown_ok = (time.perf_counter() - last_commit_ts) >= COMMIT_COOLDOWN_SEC
                if ((ready_by_still or ready_by_rapid)
                        and cooldown_ok
                        and best_word != last_word):
                    sentence.append(best_word)
                    last_word   = best_word
                    still_count = 0
                    rapid_word = ""
                    rapid_streak = 0
                    last_commit_ts = time.perf_counter()
                    if len(sentence) > MAX_SENTENCE_WORDS:
                        sentence.pop(0)
                    print(f"  Committed: {best_word}  |  Sentence: {' '.join(sentence)}")

            draw_hands(frame, hand_res)
            canvas = draw_ui(frame, sentence, top3, still_count, len(buffer), is_video)
            cv2.imshow("ASL Gesture to Sentence", canvas)

            wait = 30 if is_video else 1
            key  = cv2.waitKey(wait) & 0xFF
            if key in (ord("q"), ord("Q")):
                break
            elif key in (ord("c"), ord("C")):
                sentence.clear()
                last_word   = ""
                still_count = 0
                print("  Sentence cleared")
            elif key == ord(" "):
                if top3 and top3[0][0] != last_word:
                    sentence.append(top3[0][0])
                    last_word = top3[0][0]
                    if len(sentence) > MAX_SENTENCE_WORDS:
                        sentence.pop(0)
                    print(f"  Force committed: {top3[0][0]}  |  Sentence: {' '.join(sentence)}")

    cap.release()
    cv2.destroyAllWindows()
    print(f"\nFinal sentence: {' '.join(sentence)}")


if __name__ == "__main__":
    main()
