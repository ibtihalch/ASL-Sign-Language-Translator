import tensorflow as tf
import numpy as np
from tensorflow.keras.preprocessing import image
import sys

IMG_SIZE = 64
model = tf.keras.models.load_model("model/asl_model.h5")

import os
class_names = sorted(os.listdir("data/train"))

def predict_image(img_path):
    img = image.load_img(img_path, target_size=(IMG_SIZE, IMG_SIZE))
    img_array = image.img_to_array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    predictions = model.predict(img_array)
    predicted_class = class_names[np.argmax(predictions)]
    confidence = np.max(predictions) * 100

    print(f"✅ Prédiction : {predicted_class}")
    print(f"✅ Confiance  : {confidence:.2f}%")

# Exemple d'utilisation
predict_image("data/test/A/0.jpg")