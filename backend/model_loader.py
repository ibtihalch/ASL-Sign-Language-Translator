import json
import os
import pickle
from pathlib import Path

import cv2
import numpy as np
import tensorflow as tf

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"
IMG_SIZE = 64

_HISTORY = []
_HISTORY_SIZE = 5


def _load_class_names():
    candidates = [
        BASE_DIR.parent / "data" / "train",
        BASE_DIR / "data" / "train",
    ]
    for train_dir in candidates:
        if train_dir.exists() and train_dir.is_dir():
            classes = sorted(
                d.name for d in train_dir.iterdir() if d.is_dir()
            )
            if classes:
                return classes
    return list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + ["space", "del", "nothing"]


CLASS_NAMES = _load_class_names()


def load_letter_model():
    model_path = MODEL_DIR / "asl_model.h5"
    if not model_path.exists():
        raise FileNotFoundError(f"Missing letter model file: {model_path}")
    model = tf.keras.models.load_model(str(model_path), compile=False)
    print(f"Loaded letter model with {len(CLASS_NAMES)} classes")
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


def preprocess_letter_frame(frame):
    x, y, w, h = 100, 100, 300, 300
    roi = frame[y : y + h, x : x + w]
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


def predict_gesture(model, frame):
    global _HISTORY

    processed = preprocess_letter_frame(frame)
    predictions = model.predict(processed, verbose=0)
    class_index = int(np.argmax(predictions))
    confidence = float(np.max(predictions)) * 100.0

    _HISTORY.append(class_index)
    if len(_HISTORY) > _HISTORY_SIZE:
        _HISTORY.pop(0)

    stable_index = max(set(_HISTORY), key=_HISTORY.count) if _HISTORY else class_index
    top3_idx = np.argsort(predictions[0])[::-1][:3]
    top3 = [
        {
            "letter": CLASS_NAMES[int(i)] if int(i) < len(CLASS_NAMES) else "?",
            "confidence": round(float(predictions[0][int(i)]) * 100, 2),
        }
        for i in top3_idx
    ]

    return {
        "letter": CLASS_NAMES[stable_index] if stable_index < len(CLASS_NAMES) else "?",
        "confidence": round(confidence, 2),
        "top3": top3,
    }


def reset_letter_history():
    _HISTORY.clear()


def _build_word_model(num_classes):
    inputs = tf.keras.Input(shape=(20, 225))
    x = tf.keras.layers.LayerNormalization()(inputs)
    x = tf.keras.layers.Bidirectional(
        tf.keras.layers.LSTM(128, return_sequences=True)
    )(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    x = tf.keras.layers.Bidirectional(
        tf.keras.layers.LSTM(64, return_sequences=False)
    )(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    x = tf.keras.layers.Dense(256, activation="relu")(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.4)(x)
    x = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    return tf.keras.Model(inputs, x)


def load_word_model():
    mapping_path = MODEL_DIR / "mapping.json"
    if not mapping_path.exists():
        raise FileNotFoundError(f"Missing mapping file: {mapping_path}")

    with open(mapping_path, encoding="utf-8") as f:
        mapping = json.load(f)

    if "index_to_word" in mapping:
        idx_to_word = {int(k): v for k, v in mapping["index_to_word"].items()}
    elif "selected_words" in mapping:
        idx_to_word = {i: w for i, w in enumerate(mapping["selected_words"])}
    elif "word_to_index" in mapping:
        idx_to_word = {int(v): k for k, v in mapping["word_to_index"].items()}
    else:
        idx_to_word = {int(k): v for k, v in mapping.items()}

    num_classes = len(idx_to_word)

    h5_path = MODEL_DIR / "model_landmarks.h5"
    if h5_path.exists():
        try:
            model = tf.keras.models.load_model(str(h5_path), compile=False)
            print(f"Loaded word model from H5 with {num_classes} classes")
            return model, idx_to_word
        except Exception as e:
            print(f"Word H5 load failed ({e}), trying pickle weights")

    weights_path = MODEL_DIR / "model_weights.pkl"
    if not weights_path.exists():
        raise FileNotFoundError(f"Missing fallback weights file: {weights_path}")

    model = _build_word_model(num_classes)
    with open(weights_path, "rb") as f:
        weights = pickle.load(f)
    model.set_weights(weights)
    print(f"Loaded word model from pickle with {num_classes} classes")
    return model, idx_to_word


# Backward compatibility for existing imports.
def load_model():
    return load_word_model()
