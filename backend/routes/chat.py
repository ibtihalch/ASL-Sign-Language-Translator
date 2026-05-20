from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from config import db, users_collection
from bson import ObjectId
from datetime import datetime, timezone
import base64, os

chat_bp = Blueprint("chat", __name__)
messages_col = db["chat_messages"]

# ── Helper ───────────────────────────────────────────────────────────────────
def _fmt(msg):
    return {
        "id"         : str(msg["_id"]),
        "from_id"    : msg.get("from_id", ""),
        "to_id"      : msg.get("to_id", ""),
        "text"       : msg.get("text", ""),
        "type"       : msg.get("type", "text"),
        "media_url"  : msg.get("media_url", ""),
        "asl_word"   : msg.get("asl_word", ""),
        "created_at" : msg.get("created_at", "").isoformat() if hasattr(msg.get("created_at",""), "isoformat") else str(msg.get("created_at","")),
        "read"       : msg.get("read", False),
    }

def _are_friends(me_id, other_id):
    me = users_collection.find_one({"_id": ObjectId(me_id)})
    return me and other_id in me.get("friends", [])

# ── GET /api/chat/conversations ──────────────────────────────────────────────
@chat_bp.route("/chat/conversations", methods=["GET"])
@jwt_required()
def get_conversations():
    me_id = get_jwt_identity()
    me    = users_collection.find_one({"_id": ObjectId(me_id)})
    friends_ids = me.get("friends", [])

    convs = []
    for fid in friends_ids:
        try:
            friend = users_collection.find_one({"_id": ObjectId(fid)})
            if not friend:
                continue

            last_msg = messages_col.find_one(
                {"$or": [
                    {"from_id": me_id, "to_id": fid},
                    {"from_id": fid,   "to_id": me_id},
                ]},
                sort=[("created_at", -1)]
            )

            unread = messages_col.count_documents({
                "from_id": fid,
                "to_id"  : me_id,
                "read"   : False,
            })

            convs.append({
                "friend_id"   : fid,
                "friend_name" : friend.get("name", ""),
                "friend_photo": friend.get("photo", ""),
                "last_message": _fmt(last_msg) if last_msg else None,
                "unread"      : unread,
            })
        except Exception:
            continue

    convs.sort(
        key=lambda c: c["last_message"]["created_at"] if c["last_message"] else "",
        reverse=True
    )
    return jsonify(convs), 200


# ── GET /api/chat/messages/:friend_id ───────────────────────────────────────
@chat_bp.route("/chat/messages/<friend_id>", methods=["GET"])
@jwt_required()
def get_messages(friend_id):
    me_id = get_jwt_identity()

    if not _are_friends(me_id, friend_id):
        return jsonify({"error": "Non autorisé"}), 403

    page     = int(request.args.get("page", 1))
    per_page = 30
    skip     = (page - 1) * per_page

    msgs = list(messages_col.find(
        {"$or": [
            {"from_id": me_id,    "to_id": friend_id},
            {"from_id": friend_id,"to_id": me_id},
        ]},
        sort=[("created_at", -1)],
        skip=skip,
        limit=per_page
    ))
    msgs.reverse()

    messages_col.update_many(
        {"from_id": friend_id, "to_id": me_id, "read": False},
        {"$set": {"read": True}}
    )

    return jsonify([_fmt(m) for m in msgs]), 200


# ── POST /api/chat/messages ──────────────────────────────────────────────────
@chat_bp.route("/chat/messages", methods=["POST"])
@jwt_required()
def send_message():
    me_id = get_jwt_identity()
    data  = request.get_json()

    to_id    = data.get("to_id", "")
    msg_type = data.get("type", "text")

    if not to_id:
        return jsonify({"error": "to_id manquant"}), 400
    if not _are_friends(me_id, to_id):
        return jsonify({"error": "Non autorisé — pas amis"}), 403

    msg = {
        "from_id"   : me_id,
        "to_id"     : to_id,
        "type"      : msg_type,
        "text"      : data.get("text", ""),
        "asl_word"  : data.get("asl_word", ""),
        "media_url" : "",
        "read"      : False,
        "created_at": datetime.now(timezone.utc),
    }

    # ── Photo: stocker le base64 directement comme media_url ─────────────────
    if msg_type == "photo" and data.get("photo_b64"):
        msg["media_url"] = data["photo_b64"]

    # ── Audio: stocker le base64 comme media_url ──────────────────────────────
    # FIX: le frontend envoie audio_b64 (dataURL base64), on le stocke tel quel
    # Le tag <audio src="data:audio/webm;base64,..."> fonctionne directement
    elif msg_type == "audio" and data.get("audio_b64"):
        audio_b64 = data["audio_b64"]
        # Valider que c'est bien une dataURL audio
        if audio_b64.startswith("data:audio"):
            msg["media_url"] = audio_b64
        else:
            # Si c'est du base64 pur (sans prefix data:), ajouter le prefix
            msg["media_url"] = f"data:audio/webm;base64,{audio_b64}"

    result = messages_col.insert_one(msg)
    msg["_id"] = result.inserted_id

    # ── Notification ──────────────────────────────────────────────────────────
    try:
        from routes.notifications import create_notification
        sender = users_collection.find_one({"_id": ObjectId(me_id)})
        sender_name  = sender.get("name", "Quelqu'un") if sender else "Quelqu'un"
        sender_photo = sender.get("photo", "")        if sender else ""

        if msg_type == "asl":
            preview = f"Signe ASL : {data.get('asl_word', '')}"
        elif msg_type == "photo":
            preview = "📷 Photo"
        elif msg_type == "audio":
            preview = "🎤 Message vocal"
        else:
            text = data.get("text", "")
            preview = text[:50] + ("..." if len(text) > 50 else "")

        create_notification(
            to_user_id  = to_id,
            type        = "message",
            title       = f"💬 {sender_name}",
            body        = preview,
            from_user_id= me_id,
            from_name   = sender_name,
            from_photo  = sender_photo,
        )
    except Exception as e:
        print(f"[chat] notification error: {e}")

    return jsonify(_fmt(msg)), 201


# ── DELETE /api/chat/messages/:id ───────────────────────────────────────────
@chat_bp.route("/chat/messages/<msg_id>", methods=["DELETE"])
@jwt_required()
def delete_message(msg_id):
    me_id = get_jwt_identity()
    try:
        msg = messages_col.find_one({"_id": ObjectId(msg_id)})
    except Exception:
        return jsonify({"error": "ID invalide"}), 400

    if not msg:
        return jsonify({"error": "Message introuvable"}), 404
    if msg["from_id"] != me_id:
        return jsonify({"error": "Non autorisé"}), 403

    messages_col.delete_one({"_id": ObjectId(msg_id)})
    return jsonify({"message": "Supprimé"}), 200


# ── GET /api/chat/unread ─────────────────────────────────────────────────────
@chat_bp.route("/chat/unread", methods=["GET"])
@jwt_required()
def total_unread():
    me_id = get_jwt_identity()
    count = messages_col.count_documents({"to_id": me_id, "read": False})
    return jsonify({"unread": count}), 200