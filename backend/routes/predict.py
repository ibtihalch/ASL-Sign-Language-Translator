from flask import Blueprint, request, jsonify
from model_loader import predict_gesture
import numpy as np
import cv2
import base64

predict_bp = Blueprint("predict", __name__)

def get_model():
    from app import model
    return model

@predict_bp.route("/predict", methods=["POST", "OPTIONS"])
def predict():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response, 200

    try:
        data = request.get_json()
        if not data or "image" not in data:
            return jsonify({"error": "Aucune image reçue"}), 400

        image_data = data["image"]
        if "," in image_data:
            image_data = image_data.split(",")[1]

        img_bytes = base64.b64decode(image_data)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        frame     = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        if frame is None:
            return jsonify({"error": "Image invalide"}), 400

        result = predict_gesture(get_model(), frame)
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500