import base64

import cv2
import numpy as np
from flask import Blueprint, jsonify, request, current_app

from backend.realtime_service import process_frame, reset_session

realtime_asl_bp = Blueprint("realtime_asl", __name__)


def _get_model():
    return (
        current_app.config["ASL_MODEL"],
        current_app.config["ASL_IDX_TO_WORD"]
    )


def _decode_image_from_payload(data: dict):
    image_data = data.get("image") or data.get("frame") or data.get("frame_b64")
    if not image_data or not isinstance(image_data, str):
        return None, "Missing image"

    payload = image_data.split(",", 1)[1] if "," in image_data else image_data
    payload = payload.strip()
    if not payload:
        return None, "Empty image payload"

    try:
        img_bytes = base64.b64decode(payload, validate=True)
    except Exception:
        return None, "Invalid base64 image payload"

    nparr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return None, "Could not decode image bytes"

    return frame, None


@realtime_asl_bp.route("/frame", methods=["POST", "OPTIONS"])
def process_frame_route():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response, 200

    try:
        data  = request.get_json(silent=True) or {}
        frame, decode_error = _decode_image_from_payload(data)
        if decode_error:
            return jsonify({"error": decode_error}), 400

        model, idx_to_word = _get_model()
        result = process_frame(frame, model, idx_to_word)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@realtime_asl_bp.route("/reset", methods=["POST", "OPTIONS"])
def reset_state():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response, 200

    try:
        reset_session()
        return jsonify({"status": "reset"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500