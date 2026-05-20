"""
routes/predict.py
──────────────────
POST /api/predict  → process one frame, return prediction + sentence
POST /api/reset    → clear sentence and buffer
GET  /api/words    → list of recognizable words
"""

import base64

import cv2
import numpy as np
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from backend.realtime_service import process_frame, reset_session
from backend.model_loader import load_model as _load_model

predict_bp = Blueprint("predict", __name__)

# ── Load model once at import time ───────────────────────────
_model, _idx_to_word = _load_model()


# ─────────────────────────────────────────────────────────────
#  POST /api/predict
#  Body: { "frame": "<base64 JPEG string>" }
#  Returns: prediction, confidence, top3, sentence, still_progress
# ─────────────────────────────────────────────────────────────
@predict_bp.route("/predict", methods=["POST"])
@jwt_required()
def predict():
    data = request.get_json(silent=True)
    if not data or "frame" not in data:
        return jsonify({"error": "Missing 'frame' field (base64 JPEG)"}), 400

    try:
        # Decode base64 → numpy BGR frame
        img_bytes = base64.b64decode(data["frame"])
        nparr     = np.frombuffer(img_bytes, np.uint8)
        frame     = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({"error": "Could not decode image"}), 400

        result = process_frame(frame, _model, _idx_to_word)
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────
#  POST /api/reset
#  Clears sentence and frame buffer
# ─────────────────────────────────────────────────────────────
@predict_bp.route("/reset", methods=["POST"])
@jwt_required()
def reset():
    reset_session()
    return jsonify({"message": "Session reset ✅"}), 200


# ─────────────────────────────────────────────────────────────
#  GET /api/words
#  Returns the list of words the model can recognize
# ─────────────────────────────────────────────────────────────
@predict_bp.route("/words", methods=["GET"])
@jwt_required()
def get_words():
    words = sorted(_idx_to_word.values())
    return jsonify({"words": words, "count": len(words)}), 200