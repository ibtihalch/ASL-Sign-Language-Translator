import tensorflow as tf
import numpy as np
import cv2
import os

IMG_SIZE = 64
class_names = sorted(os.listdir("../data/train"))

def load_model():
    model = tf.keras.models.load_model("model/asl_model.h5")
    print(f"✅ Modèle chargé ! {len(class_names)} classes : {class_names}")
    return model

# ─── Masque couleur peau identique à webcam_predict.py ───
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

# ─── Preprocessing identique à webcam_predict.py ─────────
def preprocess_frame(frame):
    # Zone de détection identique
    x, y, w, h = 100, 100, 300, 300
    roi = frame[y:y+h, x:x+w]

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    mask = get_skin_mask(hsv)

    # Fond blanc comme le dataset
    roi_masked = cv2.bitwise_and(roi, roi, mask=mask)
    background = np.ones_like(roi) * 255
    mask_inv = cv2.bitwise_not(mask)
    background = cv2.bitwise_and(background, background, mask=mask_inv)
    roi_final = cv2.add(roi_masked, background)

    # Resize + normalize
    img = cv2.resize(roi_final, (IMG_SIZE, IMG_SIZE))
    img = img / 255.0
    img = np.expand_dims(img, axis=0)
    return img

# ─── Prédiction avec historique pour stabiliser ──────────
history = []
HISTORY_SIZE = 5

def predict_gesture(model, frame):
    global history
    processed = preprocess_frame(frame)
    predictions = model.predict(processed, verbose=0)
    class_index = np.argmax(predictions)
    confidence = float(np.max(predictions)) * 100

    # Stabiliser avec historique
    history.append(class_index)
    if len(history) > HISTORY_SIZE:
        history.pop(0)
    stable_index = max(set(history), key=history.count)

    # Top 3 prédictions
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