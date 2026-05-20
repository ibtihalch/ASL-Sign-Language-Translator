# Dans friends.py (blueprint Flask)
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from config import db
from bson import ObjectId
from datetime import datetime, timezone

friends_bp = Blueprint("friends", __name__)
friends_col    = db["friend_requests"]
users_col      = db["users"]


def _get_user(uid):
    """Retourne nom, photo, friends_count d'un user."""
    u = users_col.find_one({"_id": ObjectId(str(uid))})
    if not u:
        return {"id": str(uid), "name": "Utilisateur", "photo": None, "friends_count": 0}
    friends_count = friends_col.count_documents({
        "$or": [{"from_id": str(uid)}, {"to_id": str(uid)}],
        "status": "accepted"
    })
    return {
        "id":            str(u["_id"]),
        "name":          u.get("name", ""),
        "photo":         u.get("photo"),
        "friends_count": friends_count,
        "role":          u.get("role", ""),
    }


# ── GET /api/friends/requests ─────────────────────────────────
# Retourne les demandes REÇUES en attente par l'utilisateur connecté
@friends_bp.route("/friends/requests", methods=["GET"])
@jwt_required()
def get_friend_requests():
    me_id = get_jwt_identity()

    reqs = list(friends_col.find({
        "to_id":  str(me_id),
        "status": "pending"
    }).sort("created_at", -1))

    result = []
    for r in reqs:
        from_id_str = str(r.get("from_id", ""))

        # Récupère les infos de l'expéditeur
        try:
            sender_doc = users_col.find_one({"_id": ObjectId(from_id_str)})
        except Exception:
            sender_doc = None

        if not sender_doc:
            continue  # skip si user supprimé

        friends_count = friends_col.count_documents({
            "$or": [
                {"from_id": from_id_str, "status": "accepted"},
                {"to_id":   from_id_str, "status": "accepted"},
            ]
        })

        created = r.get("created_at")
        created_str = created.isoformat() if hasattr(created, "isoformat") else ""

        result.append({
            "id":         str(r["_id"]),
            "status":     r.get("status", "pending"),
            "created_at": created_str,
            # ← on expose from_id à plat ET dans sender{}
            # comme ça les deux formats frontend fonctionnent
            "from_id":    from_id_str,
            "from_name":  sender_doc.get("name", ""),
            "from_photo": sender_doc.get("photo") or "",
            "sender": {
                "id":            from_id_str,
                "name":          sender_doc.get("name", ""),
                "photo":         sender_doc.get("photo") or "",
                "friends_count": friends_count,
                "role":          sender_doc.get("role", ""),
            }
        })

    return jsonify({"requests": result, "count": len(result)})


# ── POST /api/friends/request/<id> ───────────────────────────
@friends_bp.route("/friends/request/<target_id>", methods=["POST"])
@jwt_required()
def send_request(target_id):
    me_id = get_jwt_identity()
    if str(me_id) == str(target_id):
        return jsonify({"error": "Impossible de s'ajouter soi-même"}), 400

    existing = friends_col.find_one({
        "$or": [
            {"from_id": str(me_id), "to_id": str(target_id)},
            {"from_id": str(target_id), "to_id": str(me_id)},
        ]
    })
    if existing:
        return jsonify({"error": "Demande déjà existante"}), 409

    friends_col.insert_one({
        "from_id":    str(me_id),
        "to_id":      str(target_id),
        "status":     "pending",
        "created_at": datetime.now(timezone.utc),
    })

    # Créer une notification pour le destinataire
    try:
        from notifications import create_notification
        me = users_col.find_one({"_id": ObjectId(str(me_id))})
        me_name  = me.get("name", "Quelqu'un") if me else "Quelqu'un"
        me_photo = me.get("photo") if me else None
        create_notification(
            to_user_id=target_id,
            type="friend_request",
            title="Nouvelle demande d'ami",
            body=f"{me_name} vous a envoyé une demande d'ami",
            from_user_id=me_id,
            from_name=me_name,
            from_photo=me_photo or "",
        )
    except Exception as e:
        print(f"[NOTIF ERROR] {e}")

    return jsonify({"ok": True})


# ── POST /api/friends/accept/<sender_id> ─────────────────────
@friends_bp.route("/friends/accept/<sender_id>", methods=["POST"])
@jwt_required()
def accept_request(sender_id):
    me_id = get_jwt_identity()

    result = friends_col.update_one(
        {"from_id": str(sender_id), "to_id": str(me_id), "status": "pending"},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        return jsonify({"error": "Demande introuvable"}), 404

    # Notification à l'expéditeur
    try:
        from notifications import create_notification
        me = users_col.find_one({"_id": ObjectId(str(me_id))})
        me_name  = me.get("name", "Quelqu'un") if me else "Quelqu'un"
        me_photo = me.get("photo") if me else None
        create_notification(
            to_user_id=sender_id,
            type="friend_accept",
            title="Demande acceptée",
            body=f"{me_name} a accepté votre demande d'ami",
            from_user_id=me_id,
            from_name=me_name,
            from_photo=me_photo or "",
        )
    except Exception as e:
        print(f"[NOTIF ERROR] {e}")

    return jsonify({"ok": True})


# ── POST /api/friends/decline/<sender_id> ────────────────────
@friends_bp.route("/friends/decline/<sender_id>", methods=["POST"])
@jwt_required()
def decline_request(sender_id):
    me_id = get_jwt_identity()
    friends_col.delete_one({
        "from_id": str(sender_id),
        "to_id":   str(me_id),
        "status":  "pending"
    })
    return jsonify({"ok": True})


# ── DELETE /api/friends/<id> — supprimer un ami ──────────────
@friends_bp.route("/friends/<friend_id>", methods=["DELETE"])
@jwt_required()
def remove_friend(friend_id):
    me_id = get_jwt_identity()
    friends_col.delete_one({
        "$or": [
            {"from_id": str(me_id),      "to_id": str(friend_id)},
            {"from_id": str(friend_id),  "to_id": str(me_id)},
        ],
        "status": "accepted"
    })
    return jsonify({"ok": True})