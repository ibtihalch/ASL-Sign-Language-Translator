import tensorflow as tf
import pickle
import json
from pathlib import Path

BASE_DIR  = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"


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


def load_model():
    """
    Returns (model, idx_to_word).
    Tries H5 first (cleaner), falls back to pickle weights.
    """
    with open(MODEL_DIR / "mapping.json", encoding="utf-8") as f:
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

    # Try H5 first
    h5_path = MODEL_DIR / "model_landmarks.h5"
    if h5_path.exists():
        try:
            model = tf.keras.models.load_model(str(h5_path), compile=False)
            print(f"✅ Model loaded from H5 — {num_classes} words")
            return model, idx_to_word
        except Exception as e:
            print(f"⚠️  H5 load failed ({e}), trying pickle...")

    # Fallback to pickle weights
    model = build_model(num_classes)
    with open(MODEL_DIR / "model_weights.pkl", "rb") as f:
        weights = pickle.load(f)
    model.set_weights(weights)
    print(f"✅ Model loaded from pickle — {num_classes} words")
    return model, idx_to_word