"""
Realtime ASL inference service.
Receives raw BGR frames and returns predictions + sentence state.
Includes optional Ollama integration for natural sentence generation.
"""

import threading
import time
import urllib.request
import os
import json
import re
from collections import deque
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None


# Configuration
BUFFER_SIZE = 20
INFER_EVERY = 10
STILL_THRESHOLD = 0.015
STILL_FRAMES_NEEDED = 6
MIN_CONFIDENCE = 0.28
MAX_SENTENCE_WORDS = 12
INFER_MIN_SECONDS = 0.12
NO_HAND_RESET_FRAMES = 2
RAPID_CONFIDENCE = 0.72
RAPID_STREAK_NEEDED = 3
COMMIT_COOLDOWN_SEC = 0.45
MAX_SENTENCE_ALTERNATIVES = 5

MODEL_DIR = Path(__file__).resolve().parent / "model"

HAND_TASK_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
)
POSE_TASK_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
)


# Auto-download .task files
for path, url in [
    (MODEL_DIR / "hand_landmarker.task", HAND_TASK_URL),
    (MODEL_DIR / "pose_landmarker.task", POSE_TASK_URL),
]:
    if not path.exists():
        print(f"Downloading {path.name}...")
        urllib.request.urlretrieve(url, path)


# Mediapipe detectors (created once)
_hand_det = mp_vision.HandLandmarker.create_from_options(
    mp_vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(
            model_asset_path=str(MODEL_DIR / "hand_landmarker.task")
        ),
        running_mode=mp_vision.RunningMode.IMAGE,
        num_hands=2,
    )
)
_pose_det = mp_vision.PoseLandmarker.create_from_options(
    mp_vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(
            model_asset_path=str(MODEL_DIR / "pose_landmarker.task")
        ),
        running_mode=mp_vision.RunningMode.IMAGE,
    )
)


# Ollama
OLLAMA_URL = "http://localhost:11434/api/generate"
# If unset/empty, we auto-select the first installed local model.
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "").strip()
# If requested model is unavailable, allow falling back to another installed model.
OLLAMA_ALLOW_MODEL_FALLBACK = os.getenv("OLLAMA_ALLOW_MODEL_FALLBACK", "1").strip().lower() in {"1", "true", "yes", "on"}
# Optional debug logging for Ollama failures/selection.
OLLAMA_DEBUG = os.getenv("OLLAMA_DEBUG", "0").strip().lower() in {"1", "true", "yes", "on"}
# If true, while Ollama is generating we show fallback text immediately.
# If false (default), sentence stays empty/"pending" until Ollama returns.
SHOW_PENDING_FALLBACK = os.getenv("SHOW_PENDING_FALLBACK", "0").strip().lower() in {"1", "true", "yes", "on"}
# If true, when Ollama fails we do NOT synthesize creative fallback text.
# We return the cleaned gloss as minimal output.
OLLAMA_ONLY_MODE = os.getenv("OLLAMA_ONLY_MODE", "0").strip().lower() in {"1", "true", "yes", "on"}
_ollama_available = None
_ollama_last_check_ts = 0.0
_ollama_runtime_model = ""


def _normalize_model_name(name: str) -> str:
    return (name or "").strip().lower()


def _ollama_model_is_available(model_names: List[str], target_model: str) -> bool:
    target = _normalize_model_name(target_model)
    target_base = target.split(":", 1)[0]
    for name in model_names:
        n = _normalize_model_name(name)
        if not n:
            continue
        if n == target:
            return True
        if n.split(":", 1)[0] == target_base:
            return True
    return False


def _check_ollama() -> bool:
    global _ollama_available, _ollama_last_check_ts, _ollama_runtime_model
    if _ollama_available is not None and _ollama_available:
        return _ollama_available

    now = time.time()
    if _ollama_available is False and (now - _ollama_last_check_ts) < 5.0:
        return False

    _ollama_last_check_ts = now
    if requests is None:
        _ollama_available = False
        return _ollama_available
    try:
        resp = requests.get("http://localhost:11434/api/tags", timeout=1.5)
        if resp.status_code != 200:
            _ollama_available = False
        else:
            data = resp.json() if resp.content else {}
            models = data.get("models", []) if isinstance(data, dict) else []
            model_names = [str(m.get("name", "")) for m in models if isinstance(m, dict)]
            model_names = [m for m in model_names if m]
            if not model_names:
                _ollama_available = False
                _ollama_runtime_model = ""
            elif OLLAMA_MODEL:
                if _ollama_model_is_available(model_names, OLLAMA_MODEL):
                    _ollama_available = True
                    _ollama_runtime_model = OLLAMA_MODEL
                elif OLLAMA_ALLOW_MODEL_FALLBACK:
                    _ollama_available = True
                    _ollama_runtime_model = model_names[0]
                else:
                    _ollama_available = False
                    _ollama_runtime_model = ""
            else:
                _ollama_available = True
                _ollama_runtime_model = model_names[0]
    except Exception:
        _ollama_available = False
        _ollama_runtime_model = ""
    if _ollama_available:
        print(f"Ollama model available ({_ollama_runtime_model}) - natural sentences enabled")
    else:
        wanted = OLLAMA_MODEL or "<auto>"
        print(f"Ollama model unavailable ({wanted}) - using fallback sentence")
    return _ollama_available


def _cleanup_sentence(text: str) -> str:
    s = re.sub(r"\s+", " ", str(text or "")).strip().strip('"').strip("'")
    if not s:
        return ""
    s = s[0].upper() + s[1:]
    if s[-1] not in ".!?":
        s += "."
    return s


def _dedupe_preserve(items: List[str]) -> List[str]:
    out: List[str] = []
    seen = set()
    for raw in items:
        s = _cleanup_sentence(raw)
        key = s.lower()
        if not s or key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


def _fallback_candidates(gloss_words: List[str]) -> List[str]:
    cleaned = _clean_gloss_words(gloss_words)
    if not cleaned:
        return []

    core = " ".join(cleaned)
    candidates: List[str] = []

    family_words = {"mother", "father", "sister", "brother", "family", "mom", "dad"}
    progressive = {
        "go": "going",
        "come": "coming",
        "help": "helping",
        "work": "working",
        "eat": "eating",
        "drink": "drinking",
    }

    def _map_token(tok: str) -> str:
        if tok in family_words:
            return f"my {tok}"
        return progressive.get(tok, tok)

    # Question-focused templates when gloss starts with a wh-word.
    wh_words = {"who", "what", "where", "when", "why", "how"}
    if cleaned[0] in wh_words and len(cleaned) > 1:
        rest_tokens = cleaned[1:]
        rest = " ".join(_map_token(t) for t in rest_tokens)

        # Special handling for low-vocabulary frequent pattern:
        # "who go mother" -> meaningful options.
        if "go" in rest_tokens and any(w in rest_tokens for w in family_words):
            target = next((w for w in rest_tokens if w in family_words), "mother")
            candidates.extend(
                [
                    f"Who is going with my {target}",
                    f"Who is going to my {target}",
                    f"Who should go with my {target}",
                ]
            )

        candidates.extend(
            [
                f"{cleaned[0]} is {rest}",
                f"{cleaned[0]} can {rest}",
                f"{cleaned[0]} will {rest}",
            ]
        )
    else:
        mapped_core = " ".join(_map_token(t) for t in cleaned)
        candidates.extend(
            [
                mapped_core,
                f"I mean {mapped_core}",
                f"Please understand: {mapped_core}",
            ]
        )

    return _dedupe_preserve(candidates)[:MAX_SENTENCE_ALTERNATIVES]


def _fallback_sentence(gloss_words: List[str]) -> str:
    cands = _fallback_candidates(gloss_words)
    return cands[0] if cands else ""


def _minimal_sentence_from_gloss(gloss_words: List[str]) -> str:
    cleaned = _clean_gloss_words(gloss_words)
    if not cleaned:
        return ""
    return _cleanup_sentence(" ".join(cleaned))


def _clean_gloss_words(gloss_words: List[str]) -> List[str]:
    cleaned: List[str] = []
    for raw in gloss_words:
        w = str(raw).strip().lower()
        if not w:
            continue
        if cleaned and cleaned[-1] == w:
            continue
        cleaned.append(w)
    return cleaned


def _parse_ollama_suggestions(raw_text: str) -> Tuple[str, List[str]]:
    text = (raw_text or "").strip()
    if not text:
        return "", []

    payload = None
    try:
        payload = json.loads(text)
    except Exception:
        # Try to recover JSON object if model wrapped output with extra text.
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                payload = json.loads(m.group(0))
            except Exception:
                payload = None

    if isinstance(payload, dict):
        best = _cleanup_sentence(str(payload.get("best", "")))
        alts_raw = payload.get("alternatives", [])
        if not isinstance(alts_raw, list):
            alts_raw = []
        alternatives = _dedupe_preserve([str(x) for x in alts_raw if x is not None])
        if best and best.lower() not in {a.lower() for a in alternatives}:
            alternatives.insert(0, best)
        if not best and alternatives:
            best = alternatives[0]
        return best, alternatives[:MAX_SENTENCE_ALTERNATIVES]

    # Try extracting quoted candidate sentences from malformed JSON/text.
    quoted = re.findall(r'"([^"]+)"', text)
    key_like = {"best", "alternatives", "short_suggestions", "sentence", "json"}
    quoted_candidates = []
    for q in quoted:
        ql = q.strip().lower()
        if ql in key_like:
            continue
        if " " not in q:
            continue
        quoted_candidates.append(q)
    quoted_candidates = _dedupe_preserve(quoted_candidates)
    if quoted_candidates:
        return quoted_candidates[0], quoted_candidates[:MAX_SENTENCE_ALTERNATIVES]

    # Fallback line parsing
    lines = [ln.strip("-* \t,") for ln in text.splitlines() if ln.strip()]
    lines = [ln for ln in lines if ":" not in ln[:20]]
    alternatives = _dedupe_preserve(lines)
    best = alternatives[0] if alternatives else ""
    return best, alternatives[:MAX_SENTENCE_ALTERNATIVES]


def _natural_from_gloss(gloss_words: List[str]) -> Tuple[str, List[str], str]:
    if not gloss_words:
        return "", [], "none"

    if not _check_ollama() or requests is None:
        if OLLAMA_ONLY_MODE:
            minimal = _minimal_sentence_from_gloss(gloss_words)
            fallback = [minimal] if minimal else []
        else:
            fallback = _fallback_candidates(gloss_words)
        return (fallback[0] if fallback else ""), fallback, "fallback"

    gloss = " ".join(gloss_words)
    cleaned_gloss_words = _clean_gloss_words(gloss_words)
    cleaned_gloss = " ".join(cleaned_gloss_words)
    prompt = (
        "You convert noisy ASL gloss tokens into natural English.\n"
        "Rules:\n"
        "- Tokens may include repeated words and recognition noise.\n"
        "- Infer the most likely intended meaning.\n"
        "- Remove accidental repetition.\n"
        "- Generate 3 to 5 short grammatical sentence suggestions in English.\n"
        "- Expand lightly with pronouns, prepositions, and helper words.\n"
        "- Keep meaning close to tokens.\n"
        "- Return STRICT JSON only, no markdown:\n"
        '  {"best":"...", "alternatives":["...", "...", "..."]}\n'
        f"Raw tokens: {gloss}\n"
        f"Deduped tokens: {cleaned_gloss}\n"
        "JSON:"
    )
    try:
        resp = requests.post(
            OLLAMA_URL,
            json={
                "model": _ollama_runtime_model or OLLAMA_MODEL or "llama3.2:1b",
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 80},
            },
            timeout=12.0,
        )
        if resp.status_code != 200:
            if OLLAMA_DEBUG:
                print(f"Ollama generate failed: status={resp.status_code} body={(resp.text or '')[:300]}")
            raise RuntimeError(f"Ollama HTTP {resp.status_code}")
        text = (resp.json().get("response") or "").strip()
        best, alternatives = _parse_ollama_suggestions(text)
        if best:
            return best, alternatives, "ollama"
    except Exception as e:
        if OLLAMA_DEBUG:
            print(f"Ollama generation error: {e}")

    if OLLAMA_ONLY_MODE:
        minimal = _minimal_sentence_from_gloss(cleaned_gloss_words or gloss_words)
        fallback = [minimal] if minimal else []
    else:
        fallback = _fallback_candidates(cleaned_gloss_words or gloss_words)
    return (fallback[0] if fallback else ""), fallback, "fallback"


def gloss_to_natural(gloss_words: List[str]) -> str:
    sentence, _, _ = _natural_from_gloss(gloss_words)
    return sentence


def gloss_to_natural_candidates(gloss_words: List[str]) -> Tuple[str, List[str], str]:
    return _natural_from_gloss(gloss_words)


def _normalize(features: np.ndarray) -> np.ndarray:
    out = features.copy()

    lh = out[0:63].reshape(21, 3)
    if np.any(lh != 0):
        lh = lh - lh[0]
        s = np.max(np.linalg.norm(lh, axis=1)) + 1e-8
        out[0:63] = (lh / s).flatten()

    rh = out[63:126].reshape(21, 3)
    if np.any(rh != 0):
        rh = rh - rh[0]
        s = np.max(np.linalg.norm(rh, axis=1)) + 1e-8
        out[63:126] = (rh / s).flatten()

    pose = out[126:225].reshape(33, 3)
    if np.any(pose != 0):
        pose = pose - pose[0]
        sw = np.linalg.norm(pose[11] - pose[12]) + 1e-8
        out[126:225] = (pose / sw).flatten()

    return out.astype(np.float32)


def _detect_results(frame_bgr: np.ndarray):
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    hand_res = _hand_det.detect(mp_img)
    pose_res = _pose_det.detect(mp_img)
    return hand_res, pose_res


def _extract_from_results(hand_res, pose_res) -> np.ndarray:
    feat = np.zeros(225, dtype=np.float32)
    lh = np.zeros((21, 3), dtype=np.float32)
    rh = np.zeros((21, 3), dtype=np.float32)

    if hand_res and hand_res.hand_landmarks:
        for i, landmarks in enumerate(hand_res.hand_landmarks):
            xyz = np.array([[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32)
            side = None
            if hand_res.handedness and i < len(hand_res.handedness):
                side = hand_res.handedness[i][0].category_name.lower()
            if side == "left":
                lh = xyz
            elif side == "right":
                rh = xyz
            else:
                if not np.any(lh):
                    lh = xyz
                elif not np.any(rh):
                    rh = xyz

    if pose_res and pose_res.pose_landmarks:
        pose = np.array(
            [[lm.x, lm.y, lm.z] for lm in pose_res.pose_landmarks[0]],
            dtype=np.float32,
        )
        feat[126:225] = pose.flatten()

    feat[0:63] = lh.flatten()
    feat[63:126] = rh.flatten()
    return feat


def _draw_hands(frame: np.ndarray, hand_res) -> None:
    if not hand_res or not hand_res.hand_landmarks:
        return
    h, w = frame.shape[:2]
    for hand in hand_res.hand_landmarks:
        for lm in hand:
            x, y = int(lm.x * w), int(lm.y * h)
            if 0 <= x < w and 0 <= y < h:
                cv2.circle(frame, (x, y), 4, (0, 255, 0), -1)


_state_lock = threading.Lock()
_state: Dict[str, object] = {
    "buffer": deque(maxlen=BUFFER_SIZE),
    "gloss_words": [],
    "natural_sentence": "",
    "sentence_alternatives": [],
    "sentence_source": "none",
    "sentence_pending": False,
    "last_word": "",
    "still_count": 0,
    "frame_idx": 0,
    "top3": [],
    "last_infer_ts": 0.0,
    "generation_request_id": 0,
    "generated_request_id": 0,
    "natural_generation_active": False,
    "no_hand_frames": 0,
    "rapid_word": "",
    "rapid_streak": 0,
    "last_commit_ts": 0.0,
    "last_commit_mode": "none",
}


def _schedule_sentence_generation() -> None:
    with _state_lock:
        _state["generation_request_id"] += 1
        _state["sentence_pending"] = True
        if _state["natural_generation_active"]:
            return
        _state["natural_generation_active"] = True

    worker = threading.Thread(target=_sentence_worker, daemon=True)
    worker.start()


def _sentence_worker() -> None:
    while True:
        with _state_lock:
            req_id = int(_state["generation_request_id"])
            gloss_snapshot = list(_state["gloss_words"])

        sentence, alternatives, source = _natural_from_gloss(gloss_snapshot)

        with _state_lock:
            if req_id >= int(_state["generated_request_id"]):
                _state["natural_sentence"] = sentence
                _state["sentence_alternatives"] = list(alternatives)
                _state["sentence_source"] = source
                _state["generated_request_id"] = req_id
                _state["sentence_pending"] = False

            done = int(_state["generated_request_id"]) >= int(_state["generation_request_id"])
            if done:
                _state["natural_generation_active"] = False
                break


def reset_session() -> None:
    with _state_lock:
        _state["buffer"].clear()
        _state["gloss_words"].clear()
        _state["natural_sentence"] = ""
        _state["sentence_alternatives"] = []
        _state["sentence_source"] = "none"
        _state["sentence_pending"] = False
        _state["last_word"] = ""
        _state["still_count"] = 0
        _state["frame_idx"] = 0
        _state["top3"] = []
        _state["last_infer_ts"] = 0.0
        _state["generation_request_id"] = 0
        _state["generated_request_id"] = 0
        _state["natural_generation_active"] = False
        _state["no_hand_frames"] = 0
        _state["rapid_word"] = ""
        _state["rapid_streak"] = 0
        _state["last_commit_ts"] = 0.0
        _state["last_commit_mode"] = "none"


def process_frame(frame_bgr: np.ndarray, model, idx_to_word: dict, include_annotated: bool = False) -> dict:
    hand_res, pose_res = _detect_results(frame_bgr)
    hand_present = bool(hand_res and hand_res.hand_landmarks and len(hand_res.hand_landmarks) > 0)
    raw = _extract_from_results(hand_res, pose_res)
    norm = _normalize(raw)
    hand_mean = float(np.mean(np.abs(norm[:126])))
    now = time.perf_counter()
    word_committed = False
    commit_mode = "none"
    inferred_now = False

    with _state_lock:
        s = _state
        if hand_present:
            s["no_hand_frames"] = 0
            s["buffer"].append(norm)
            if hand_mean < STILL_THRESHOLD:
                s["still_count"] += 1
            else:
                s["still_count"] = 0
        else:
            s["no_hand_frames"] += 1
            s["still_count"] = 0
            s["rapid_word"] = ""
            s["rapid_streak"] = 0
            if int(s["no_hand_frames"]) >= NO_HAND_RESET_FRAMES:
                s["top3"] = []
                s["buffer"].clear()

        s["frame_idx"] += 1
        should_infer_by_time = (now - float(s["last_infer_ts"])) >= INFER_MIN_SECONDS
        should_infer_by_frame = (int(s["frame_idx"]) % INFER_EVERY) == 0
        if (
            hand_present
            and len(s["buffer"]) == BUFFER_SIZE
            and (should_infer_by_time or should_infer_by_frame)
        ):
            seq = np.array(s["buffer"], dtype=np.float32)[np.newaxis]
            pred = model.predict(seq, verbose=0)[0]
            idx3 = np.argsort(pred)[::-1][:3]
            s["top3"] = [
                {"word": idx_to_word.get(int(i), "?"), "confidence": float(pred[i])}
                for i in idx3
            ]
            s["last_infer_ts"] = now
            inferred_now = True

        if hand_present and inferred_now and s["top3"]:
            best_word = s["top3"][0]["word"]
            best_conf = s["top3"][0]["confidence"]
            if best_conf >= RAPID_CONFIDENCE:
                if best_word == s["rapid_word"]:
                    s["rapid_streak"] += 1
                else:
                    s["rapid_word"] = best_word
                    s["rapid_streak"] = 1
            else:
                s["rapid_word"] = ""
                s["rapid_streak"] = 0

        if hand_present and s["top3"]:
            best_word = s["top3"][0]["word"]
            best_conf = s["top3"][0]["confidence"]
            ready_by_still = (
                s["still_count"] >= STILL_FRAMES_NEEDED and best_conf >= MIN_CONFIDENCE
            )
            ready_by_rapid = (
                s["rapid_streak"] >= RAPID_STREAK_NEEDED and best_conf >= RAPID_CONFIDENCE
            )
            cooldown_ok = (now - float(s["last_commit_ts"])) >= COMMIT_COOLDOWN_SEC
            if (
                cooldown_ok
                and (ready_by_still or ready_by_rapid)
                and best_word != s["last_word"]
            ):
                s["gloss_words"].append(best_word)
                s["last_word"] = best_word
                s["still_count"] = 0
                s["rapid_word"] = ""
                s["rapid_streak"] = 0
                s["last_commit_ts"] = now
                word_committed = True
                commit_mode = "rapid" if ready_by_rapid else "still"
                s["last_commit_mode"] = commit_mode
                if len(s["gloss_words"]) > MAX_SENTENCE_WORDS:
                    s["gloss_words"].pop(0)

                # While waiting for generation, either show fallback instantly
                # or keep sentence empty so UI clearly reflects pending state.
                if SHOW_PENDING_FALLBACK:
                    s["natural_sentence"] = _fallback_sentence(s["gloss_words"])
                    s["sentence_alternatives"] = _fallback_candidates(s["gloss_words"])
                else:
                    s["natural_sentence"] = ""
                    s["sentence_alternatives"] = []
                s["sentence_source"] = "pending"

    if word_committed:
        _schedule_sentence_generation()

    with _state_lock:
        top3 = list(_state["top3"])
        gloss_words = list(_state["gloss_words"])
        sentence = str(_state["natural_sentence"])
        sentence_alternatives = list(_state["sentence_alternatives"])
        sentence_source = str(_state["sentence_source"])
        sentence_pending = bool(_state["sentence_pending"])
        still_count = int(_state["still_count"])
        rapid_streak = int(_state["rapid_streak"])
        buf_len = len(_state["buffer"])
        last_commit_mode = str(_state["last_commit_mode"])

    frame_b64 = ""
    if include_annotated:
        annotated = frame_bgr.copy()
        _draw_hands(annotated, hand_res)
        ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if ok:
            import base64

            frame_b64 = base64.b64encode(buf).decode("utf-8")

    return {
        "prediction": top3[0]["word"] if top3 else "",
        "confidence": top3[0]["confidence"] if top3 else 0.0,
        "top3": top3,
        "hand_present": hand_present,
        "gloss": " ".join(gloss_words),
        "sentence": sentence,
        "sentence_alternatives": sentence_alternatives,
        "sentence_source": sentence_source,
        "sentence_pending": sentence_pending,
        "ollama_enabled": True if _ollama_available is True else False if _ollama_available is False else None,
        "word_committed": word_committed,
        "commit_mode": commit_mode if word_committed else last_commit_mode,
        "still_count": min(still_count, STILL_FRAMES_NEEDED),
        "still_needed": STILL_FRAMES_NEEDED,
        "commit_ready": bool(hand_present and still_count >= STILL_FRAMES_NEEDED),
        "still_progress": min(still_count, STILL_FRAMES_NEEDED) / STILL_FRAMES_NEEDED,
        "rapid_count": min(rapid_streak, RAPID_STREAK_NEEDED),
        "rapid_needed": RAPID_STREAK_NEEDED,
        "rapid_confidence_threshold": RAPID_CONFIDENCE,
        "buf_len": buf_len,
        "buf_size": BUFFER_SIZE,
        "frame_b64": frame_b64,
    }
