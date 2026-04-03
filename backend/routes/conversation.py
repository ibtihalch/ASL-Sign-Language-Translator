from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from config import messages_collection
from datetime import datetime
from bson import ObjectId

conv_bp = Blueprint("conversation", __name__)


# ─── Sauvegarder un message ────────────────────────────────
@conv_bp.route("/message", methods=["POST"])
@jwt_required()
def save_message():
    user_id = get_jwt_identity()
    data    = request.get_json()
    text    = data.get("text", "").strip()

    if not text:
        return jsonify({"error": "Message vide"}), 400

    message = {
        "user_id"   : user_id,
        "text"      : text,
        "type"      : data.get("type", "asl"),
        "created_at": datetime.utcnow()
    }

    result = messages_collection.insert_one(message)
    return jsonify({
        "message": "Sauvegardé ✅",
        "id"     : str(result.inserted_id)
    }), 201


# ─── Récupérer l'historique avec pagination ───────────────
@conv_bp.route("/history", methods=["GET"])
@jwt_required()
def get_history():
    user_id  = get_jwt_identity()
    page     = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    type_filter = request.args.get("type", None)   # "asl" | "speech" | None

    query = {"user_id": user_id}
    if type_filter in ["asl", "speech"]:
        query["type"] = type_filter

    total    = messages_collection.count_documents(query)
    messages = list(
        messages_collection.find(query)
        .sort("created_at", -1)
        .skip((page - 1) * per_page)
        .limit(per_page)
    )

    for m in messages:
        m["_id"]        = str(m["_id"])
        m["created_at"] = m["created_at"].isoformat()

    return jsonify({
        "messages"   : messages,
        "total"      : total,
        "page"       : page,
        "per_page"   : per_page,
        "total_pages": (total + per_page - 1) // per_page
    }), 200


# ─── Supprimer un message ──────────────────────────────────
@conv_bp.route("/message/<message_id>", methods=["DELETE"])
@jwt_required()
def delete_message(message_id):
    user_id = get_jwt_identity()

    try:
        obj_id = ObjectId(message_id)
    except Exception:
        return jsonify({"error": "ID invalide"}), 400

    result = messages_collection.delete_one({
        "_id"    : obj_id,
        "user_id": user_id        # sécurité : chaque user supprime ses propres messages
    })

    if result.deleted_count == 0:
        return jsonify({"error": "Message non trouvé"}), 404

    return jsonify({"message": "Supprimé ✅"}), 200


# ─── Statistiques de l'utilisateur ───────────────────────
@conv_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    user_id = get_jwt_identity()

    total        = messages_collection.count_documents({"user_id": user_id})
    total_asl    = messages_collection.count_documents({"user_id": user_id, "type": "asl"})
    total_speech = messages_collection.count_documents({"user_id": user_id, "type": "speech"})

    return jsonify({
        "total"       : total,
        "total_asl"   : total_asl,
        "total_speech": total_speech
    }), 200