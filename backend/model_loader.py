import tensorflow as tf
import numpy as np
import cv2
import os
import json

# ============================================================
# MODÈLE 1 — Alphabet (existant, inchangé)
# ============================================================
IMG_SIZE = 64
class_names = sorted(os.listdir("../data/train"))

def load_model():
    model = tf.keras.models.load_model("model/asl_model.h5")
    print(f"✅ Modèle alphabet chargé ! {len(class_names)} classes : {class_names}")
    return model

def get_skin_mask(hsv):
    lower_skin1 = np.array([0, 15, 60], dtype=np.uint8)
    upper_skin1 = np.array([25, 255, 255], dtype=np.uint8)
    lower_skin2 = np.array([170, 15, 60], dtype=np.uint8)
    upper_skin2 = np.array([180, 255, 255], dtype=np.uint8)
    mask1 = cv2.inRange(hsv, lower_skin1, upper_skin1)
    mask2 = cv2.inRange(hsv, lower_skin2, upper_skin2)
    mask = cv2.bitwise_or(mask1, mask2)
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.GaussianBlur(mask, (5, 5), 0)
    return mask

def preprocess_frame(frame):
    x, y, w, h = 100, 100, 300, 300
    roi = frame[y:y+h, x:x+w]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    mask = get_skin_mask(hsv)
    roi_masked = cv2.bitwise_and(roi, roi, mask=mask)
    background = np.ones_like(roi) * 255
    mask_inv = cv2.bitwise_not(mask)
    background = cv2.bitwise_and(background, background, mask=mask_inv)
    roi_final = cv2.add(roi_masked, background)
    img = cv2.resize(roi_final, (IMG_SIZE, IMG_SIZE))
    img = img / 255.0
    img = np.expand_dims(img, axis=0)
    return img

history = []
HISTORY_SIZE = 5

def predict_gesture(model, frame):
    global history
    processed = preprocess_frame(frame)
    predictions = model.predict(processed, verbose=0)
    class_index = np.argmax(predictions)
    confidence = float(np.max(predictions)) * 100
    history.append(class_index)
    if len(history) > HISTORY_SIZE:
        history.pop(0)
    stable_index = max(set(history), key=history.count)
    top3_idx = np.argsort(predictions[0])[::-1][:3]
    top3 = [
        {"letter": class_names[i], "confidence": round(float(predictions[0][i]) * 100, 2)}
        for i in top3_idx
    ]
    return {
        "letter": class_names[stable_index],
        "confidence": round(confidence, 2),
        "top3": top3
    }


# ============================================================
# MODÈLE 2 — Mots WLASL
# ============================================================
WLASL_SEQUENCE_LENGTH = 20
WLASL_IMG_HEIGHT = 64
WLASL_IMG_WIDTH = 64

def load_word_model():
    word_model = tf.keras.models.load_model("model/model_wlasl100.h5")
    with open("model/word_mapping.json") as f:
        mapping = json.load(f)
    index_to_word = {int(k): v for k, v in mapping["index_to_word"].items()}
    print(f"✅ Modèle mots WLASL chargé ! {mapping['num_classes']} classes")
    return word_model, index_to_word


def extract_frames_for_word(video_path):
    """Extrait 20 frames d'une vidéo mp4 pour la prédiction mot"""
    frames = []
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total == 0:
        cap.release()
        return None
    indices = np.linspace(0, total - 1, WLASL_SEQUENCE_LENGTH, dtype=int)
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret:
            frame = np.zeros((WLASL_IMG_HEIGHT, WLASL_IMG_WIDTH, 3), dtype=np.uint8)
        else:
            frame = cv2.resize(frame, (WLASL_IMG_WIDTH, WLASL_IMG_HEIGHT))
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frames.append(frame)
    cap.release()
    if len(frames) != WLASL_SEQUENCE_LENGTH:
        return None
    return np.array(frames, dtype=np.float32) / 255.0


def predict_word(word_model, index_to_word, video_path):
    """Prend un chemin vidéo .mp4, retourne le mot prédit"""
    frames = extract_frames_for_word(video_path)
    if frames is None:
        return {"error": "Impossible de lire la vidéo"}
    input_data = np.expand_dims(frames, axis=0)
    predictions = word_model.predict(input_data, verbose=0)
    predicted_index = np.argmax(predictions[0])
    confidence = float(predictions[0][predicted_index])
    word = index_to_word[predicted_index]
    return {
        "word": word,
        "confidence": round(confidence * 100, 2)
    }


def predict_word_from_frames(word_model, index_to_word, frames_np):
    """
    Prend 20 frames déjà décodées depuis la caméra React.
    frames_np : np.ndarray de shape (20, 64, 64, 3), valeurs 0-1
    """
    input_data = np.expand_dims(frames_np, axis=0)  # (1, 20, 64, 64, 3)
    predictions = word_model.predict(input_data, verbose=0)
    predicted_index = np.argmax(predictions[0])
    confidence = float(predictions[0][predicted_index])
    word = index_to_word[predicted_index]
    return {
        "word": word,
        "confidence": round(confidence * 100, 2)
    }