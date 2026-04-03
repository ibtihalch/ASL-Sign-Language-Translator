import cv2
import numpy as np
import tensorflow as tf
import os

IMG_SIZE = 64
model = tf.keras.models.load_model("backend/model/asl_model.h5")
class_names = sorted(os.listdir("data/train"))

# ─── Trouver la caméra ────────────────────────
def find_camera():
    for i in range(3):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            print(f"✅ Caméra trouvée à l'index {i}")
            return cap
    return None

# ─── Masque couleur peau amélioré ─────────────
def get_skin_mask(hsv):
    lower_skin1 = np.array([0, 15, 60], dtype=np.uint8)
    upper_skin1 = np.array([25, 255, 255], dtype=np.uint8)
    lower_skin2 = np.array([170, 15, 60], dtype=np.uint8)
    upper_skin2 = np.array([180, 255, 255], dtype=np.uint8)
    mask1 = cv2.inRange(hsv, lower_skin1, upper_skin1)
    mask2 = cv2.inRange(hsv, lower_skin2, upper_skin2)
    mask = cv2.bitwise_or(mask1, mask2)

    # Nettoyer le masque
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.GaussianBlur(mask, (5, 5), 0)
    return mask

# ─── Preprocessing ────────────────────────────
def preprocess(roi):
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    mask = get_skin_mask(hsv)

    # Appliquer masque
    roi_masked = cv2.bitwise_and(roi, roi, mask=mask)

    # Fond blanc comme le dataset
    background = np.ones_like(roi) * 255
    mask_inv = cv2.bitwise_not(mask)
    background = cv2.bitwise_and(background, background, mask=mask_inv)
    roi_final = cv2.add(roi_masked, background)

    # Resize + normalize
    img = cv2.resize(roi_final, (IMG_SIZE, IMG_SIZE))
    img = img / 255.0
    img = np.expand_dims(img, axis=0)
    return img, roi_final

# ─── Main ─────────────────────────────────────
cap = find_camera()
if cap is None:
    print("❌ Aucune caméra trouvée !")
    exit()

print("✅ Webcam démarrée ! Appuie sur 'q' pour quitter.")
print("📌 Commandes : 'q' = quitter | 's' = screenshot")

# Historique des prédictions pour stabiliser
history = []
HISTORY_SIZE = 5

while True:
    ret, frame = cap.read()
    if not ret:
        print("❌ Erreur de lecture caméra")
        break

    frame = cv2.flip(frame, 1)
    h_frame, w_frame = frame.shape[:2]

    # ── Zone de détection ──
    x, y, w, h = 100, 100, 300, 300
    roi = frame[y:y+h, x:x+w]

    # ── Preprocessing ──
    img_array, roi_final = preprocess(roi)

    # ── Prédiction ──
    predictions = model.predict(img_array, verbose=0)
    predicted_class = class_names[np.argmax(predictions)]
    confidence = np.max(predictions) * 100

    # Stabiliser avec historique
    history.append(predicted_class)
    if len(history) > HISTORY_SIZE:
        history.pop(0)
    stable_class = max(set(history), key=history.count)

    # ── Afficher main traitée ──
    roi_display = cv2.resize(roi_final, (150, 150))
    frame[10:160, w_frame-160:w_frame-10] = roi_display
    cv2.putText(frame, "Main traitee", (w_frame-160, 175),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)

    # ── Couleur selon confiance ──
    if confidence >= 70:
        color = (0, 255, 0)      # Vert
        status = "BON"
    elif confidence >= 40:
        color = (0, 165, 255)    # Orange
        status = "MOYEN"
    else:
        color = (0, 0, 255)      # Rouge
        status = "FAIBLE"

    # ── Rectangle zone détection ──
    cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)

    # ── Texte principal ──
    cv2.putText(frame, f"{stable_class} ({confidence:.1f}%)",
                (x, y-15), cv2.FONT_HERSHEY_SIMPLEX,
                1.4, color, 3)

    # ── Barre de confiance ──
    bar_x, bar_y = 10, h_frame - 60
    bar_w = 200
    bar_filled = int(bar_w * confidence / 100)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + 20),
                  (50, 50, 50), -1)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_filled, bar_y + 20),
                  color, -1)
    cv2.putText(frame, f"Confiance: {confidence:.1f}% ({status})",
                (bar_x, bar_y - 8), cv2.FONT_HERSHEY_SIMPLEX,
                0.5, color, 1)

    # ── Instructions ──
    cv2.putText(frame, "Mets ta main dans le carre vert",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX,
                0.6, (255, 255, 255), 1)
    cv2.putText(frame, "Appuie sur 'q' pour quitter",
                (10, 55), cv2.FONT_HERSHEY_SIMPLEX,
                0.6, (255, 255, 255), 1)

    # ── Classes top 3 ──
    top3_idx = np.argsort(predictions[0])[::-1][:3]
    cv2.putText(frame, "Top 3 predictions:",
                (w_frame - 250, 200), cv2.FONT_HERSHEY_SIMPLEX,
                0.5, (255, 255, 255), 1)
    for i, idx in enumerate(top3_idx):
        pct = predictions[0][idx] * 100
        txt = f"{class_names[idx]}: {pct:.1f}%"
        cv2.putText(frame, txt,
                    (w_frame - 250, 225 + i * 22),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, (200, 200, 200), 1)

    cv2.imshow("ASL Recognition", frame)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('s'):
        filename = f"screenshot_{predicted_class}_{int(confidence)}.png"
        cv2.imwrite(filename, frame)
        print(f"📸 Screenshot sauvegardé : {filename}")

cap.release()
cv2.destroyAllWindows()
print("👋 Programme terminé !")