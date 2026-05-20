"""
routes/predict.py
POST /api/predict  → process frame → prediction + sentence
POST /api/reset    → clear session
GET  /api/words    → list of words
POST /api/improve  → improve raw gloss with Ollama
"""

import base64
import cv2
import numpy as np
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required

from backend.realtime_service import process_frame, reset_session, gloss_to_natural

predict_bp = Blueprint("predict", __name__)


def _get_model():
    return (
        current_app.config["ASL_MODEL"],
        current_app.config["ASL_IDX_TO_WORD"]
    )


@predict_bp.route("/predict", methods=["POST"])
@jwt_required()
def predict():
    data = request.get_json(silent=True)
    if not data or "frame" not in data:
        return jsonify({"error": "Missing 'frame' field (base64 JPEG)"}), 400
    try:
        img_bytes = base64.b64decode(data["frame"])
        nparr     = np.frombuffer(img_bytes, np.uint8)
        frame     = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({"error": "Could not decode image"}), 400
        model, idx_to_word = _get_model()
        result = process_frame(frame, model, idx_to_word)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@predict_bp.route("/reset", methods=["POST"])
@jwt_required()
def reset():
    reset_session()
    return jsonify({"message": "Session reset"}), 200


@predict_bp.route("/words", methods=["GET"])
@jwt_required()
def get_words():
    _, idx_to_word = _get_model()
    words = sorted(idx_to_word.values())
    return jsonify({"words": words, "count": len(words)}), 200


@predict_bp.route("/improve", methods=["POST"])
@jwt_required()
def improve():
    """
    POST /api/improve
    Body: { "gloss": "mother help go" }
    Returns: { "sentence": "My mother needs help going" }
    """
    data = request.get_json(silent=True)
    if not data or "gloss" not in data:
        return jsonify({"error": "Missing 'gloss' field"}), 400
    words    = data["gloss"].strip().split()
    sentence = gloss_to_natural(words)
    return jsonify({"sentence": sentence, "gloss": data["gloss"]}), 200