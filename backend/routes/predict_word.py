from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import numpy as np
import cv2
import base64
import os
import tempfile

predict_word_bp = Blueprint("predict_word", __name__)

def get_word_model():
    from app import word_model, index_to_word
    return word_model, index_to_word


# ── Route 1 : upload fichier vidéo ──
@predict_word_bp.route("/predict/word", methods=["POST", "OPTIONS"])
def predict_word_route():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response, 200

    try:
        if "video" not in request.files:
            return jsonify({"error": "Aucune vidéo reçue"}), 400

        video = request.files["video"]
        safe_name = secure_filename(video.filename)
        
        temp_path = os.path.join(tempfile.gettempdir(), safe_name)
        video.save(temp_path)

        word_model, index_to_word = get_word_model()

        from model_loader import predict_word
        result = predict_word(word_model, index_to_word, temp_path)
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Route 2 : 20 frames base64 depuis la caméra ──
@predict_word_bp.route("/predict/word/frames", methods=["POST", "OPTIONS"])
def predict_word_frames():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response, 200

    try:
        data = request.get_json()
        frames_b64 = data.get("frames", [])

        if len(frames_b64) != 20:
            return jsonify({"error": f"20 frames requises, reçu {len(frames_b64)}"}), 400

        frames = []
        for b64 in frames_b64:
            if "," in b64:
                b64 = b64.split(",")[1]
            img_bytes = base64.b64decode(b64)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if frame is None:
                return jsonify({"error": "Frame invalide"}), 400
            frame = cv2.resize(frame, (64, 64))
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(frame)

        frames_np = np.array(frames, dtype=np.float32) / 255.0

        word_model, index_to_word = get_word_model()

        from model_loader import predict_word_from_frames
        result = predict_word_from_frames(word_model, index_to_word, frames_np)
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500