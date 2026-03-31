import cv2
import numpy as np
import tensorflow as tf
import os

IMG_SIZE = 64
model = tf.keras.models.load_model("model/asl_model.h5")
class_names = sorted(os.listdir("data/train"))

cap = cv2.VideoCapture(0)
print("✅ Webcam démarrée ! Appuie sur 'q' pour quitter.")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)

    # Zone de détection
    x, y, w, h = 100, 100, 300, 300
    roi = frame[y:y+h, x:x+w]

    # Traitement pour isoler la main
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    
    # Masque couleur peau
    lower_skin = np.array([0, 20, 70], dtype=np.uint8)
    upper_skin = np.array([20, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower_skin, upper_skin)
    
    # Nettoyer le masque
    kernel = np.ones((3,3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=2)
    mask = cv2.GaussianBlur(mask, (5,5), 0)
    
    # Appliquer le masque
    roi_masked = cv2.bitwise_and(roi, roi, mask=mask)
    
    # Fond blanc comme le dataset
    background = np.ones_like(roi) * 255
    mask_inv = cv2.bitwise_not(mask)
    background = cv2.bitwise_and(background, background, mask=mask_inv)
    roi_final = cv2.add(roi_masked, background)

    # Prétraitement
    roi_resized = cv2.resize(roi_final, (IMG_SIZE, IMG_SIZE))
    roi_array = roi_resized / 255.0
    roi_array = np.expand_dims(roi_array, axis=0)

    # Prédiction
    predictions = model.predict(roi_array, verbose=0)
    predicted_class = class_names[np.argmax(predictions)]
    confidence = np.max(predictions) * 100

    # Afficher la main traitée en haut à droite
    roi_display = cv2.resize(roi_final, (150, 150))
    frame[10:160, 450:600] = roi_display
    cv2.putText(frame, "Main traitee", (450, 175),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,0), 1)

    # Affichage principal
    cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
    
    # Couleur selon confiance
    color = (0, 255, 0) if confidence > 70 else (0, 165, 255) if confidence > 40 else (0, 0, 255)
    
    cv2.putText(frame, f"{predicted_class} ({confidence:.1f}%)",
                (x, y-10), cv2.FONT_HERSHEY_SIMPLEX,
                1.2, color, 2)

    cv2.putText(frame, "Mets ta main dans le carre",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX,
                0.6, (255,255,255), 1)
    cv2.putText(frame, "Appuie sur 'q' pour quitter",
                (10, 55), cv2.FONT_HERSHEY_SIMPLEX,
                0.6, (255,255,255), 1)

    cv2.imshow("ASL Recognition", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()