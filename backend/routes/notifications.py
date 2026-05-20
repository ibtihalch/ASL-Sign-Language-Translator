from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from config import users_collection, db

from datetime import datetime, timezone
from bson import ObjectId

notifications_bp = Blueprint("notifications", __name__)

# ── Collection dédiée aux notifications ──────────────────────
notifs_col = db["notifications"]


def create_notification(to_user_id, type, title, body,
                        from_user_id=None, from_name="", from_photo=""):
    """
    Crée une notification en base.
    Appelée depuis posts.py, friends.py, etc.
    """
    if not to_user_id:
        return

    # Pas de notif à soi-même (double sécurité)
    if from_user_id and str(from_user_id) == str(to_user_id):
        return

    notif = {
        "to_user_id":   str(to_user_id),
        "from_user_id": str(from_user_id) if from_user_id else None,
        "from_name":    from_name,
        "from_photo":   from_photo,
        "type":         type,   # post_like | post_comment | story_like | story_comment | friend_request | ...
        "title":        title,
        "body":         body,
        "read":         False,
        "created_at":   datetime.now(timezone.utc),
    }
    notifs_col.insert_one(notif)
    print(f"[NOTIF CREATED] to={to_user_id} type={type} body={body}")


def _fmt(n):
    """Sérialise une notification MongoDB en dict JSON."""
    # Icône et couleur selon le type
    type_meta = {
        "post_like":      {"icon": "heart-fill",          "color": "#f02849"},
        "post_comment":   {"icon": "chat-dots-fill",       "color": "#1877f2"},
        "story_like":     {"icon": "heart-fill",           "color": "#e91e63"},
        "story_comment":  {"icon": "chat-dots-fill",       "color": "#9c27b0"},
        "friend_request": {"icon": "person-plus-fill",     "color": "#1877f2"},
        "friend_accept":  {"icon": "people-fill",          "color": "#45bd62"},
        "message":        {"icon": "chat-fill",            "color": "#1877f2"},
        "mention":        {"icon": "at",                   "color": "#f7b125"},
    }
    meta  = type_meta.get(n.get("type", ""), {"icon": "bell-fill", "color": "#1877f2"})
    ts    = n.get("created_at")
    if hasattr(ts, "isoformat"):
        ts = ts.isoformat()

    return {
        "id":           str(n["_id"]),
        "type":         n.get("type", ""),
        "title":        n.get("title", ""),
        "body":         n.get("body", ""),
        "read":         n.get("read", False),
        "created_at":   ts,
        "from_user_id": n.get("from_user_id"),
        "from_name":    n.get("from_name", ""),
        "from_photo":   n.get("from_photo", ""),
        "icon":         meta["icon"],
        "color":        meta["color"],
    }


# ─────────────────────────────────────────
# GET /api/notifications  — liste pour l'utilisateur connecté
# ─────────────────────────────────────────
@notifications_bp.route("/notifications", methods=["GET"])
@jwt_required()
def get_notifications():
    me_id  = get_jwt_identity()
    limit  = int(request.args.get("limit", 30))
    skip   = int(request.args.get("skip", 0))

    notifs = list(
        notifs_col.find(
            {"to_user_id": str(me_id)},
            sort=[("created_at", -1)],
            limit=limit,
            skip=skip,
        )
    )
    unread = notifs_col.count_documents({"to_user_id": str(me_id), "read": False})

    return jsonify({
        "notifications": [_fmt(n) for n in notifs],
        "unread_count":  unread,
    })


# ─────────────────────────────────────────
# PATCH /api/notifications/<id>/read
# ─────────────────────────────────────────
@notifications_bp.route("/notifications/<notif_id>/read", methods=["PATCH"])
@jwt_required()
def mark_read(notif_id):
    me_id = get_jwt_identity()
    notifs_col.update_one(
        {"_id": ObjectId(notif_id), "to_user_id": str(me_id)},
        {"$set": {"read": True}}
    )
    return jsonify({"ok": True})


# ─────────────────────────────────────────
# PATCH /api/notifications/read-all
# ─────────────────────────────────────────
@notifications_bp.route("/notifications/read-all", methods=["PATCH"])
@jwt_required()
def mark_all_read():
    me_id = get_jwt_identity()
    notifs_col.update_many(
        {"to_user_id": str(me_id), "read": False},
        {"$set": {"read": True}}
    )
    return jsonify({"ok": True})


# ─────────────────────────────────────────
# DELETE /api/notifications/<id>
# ─────────────────────────────────────────
@notifications_bp.route("/notifications/<notif_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notif_id):
    me_id = get_jwt_identity()
    notifs_col.delete_one({"_id": ObjectId(notif_id), "to_user_id": str(me_id)})
    return jsonify({"ok": True})


# ─────────────────────────────────────────
# GET /api/notifications/unread-count
# ─────────────────────────────────────────
@notifications_bp.route("/notifications/unread-count", methods=["GET"])
@jwt_required()
def unread_count():
    me_id = get_jwt_identity()
    count = notifs_col.count_documents({"to_user_id": str(me_id), "read": False})
    return jsonify({"unread_count": count})