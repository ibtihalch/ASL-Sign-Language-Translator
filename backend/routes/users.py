from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from config import users_collection
from bson import ObjectId
from datetime import datetime, timezone
from routes.notifications import create_notification
import re

users_bp = Blueprint("users", __name__)

# ── helpers ──────────────────────────────────────────────────────────────────
def _pub(user, me_id=None):
    """Retourne les champs publics d'un user."""
    uid = str(user["_id"])
    friends     = user.get("friends", [])
    sent        = user.get("friend_requests_sent", [])
    received    = user.get("friend_requests_received", [])

    relation = "none"
    if me_id:
        if me_id in friends:
            relation = "friend"
        elif me_id in received:
            relation = "request_sent"
        elif me_id in sent:
            relation = "request_received"

    return {
        "id"           : uid,
        "name"         : user.get("name", ""),
        "photo"        : user.get("photo", ""),
        "role"         : user.get("role", ""),
        "asl_level"    : user.get("asl_level", "beginner"),
        "bio"          : user.get("bio", ""),
        "friends_count": len(friends),
        "relation"     : relation,
    }


# ────────────────────────────────────────────────────────────────────────────
# GET /api/users/search?q=texte
# ────────────────────────────────────────────────────────────────────────────
@users_bp.route("/users/search", methods=["GET"])
@jwt_required()
def search_users():
    me_id = get_jwt_identity()
    q     = request.args.get("q", "").strip()

    if len(q) < 2:
        return jsonify([]), 200

    regex   = re.compile(q, re.IGNORECASE)
    results = list(users_collection.find(
        {"name": regex, "_id": {"$ne": ObjectId(me_id)}},
        limit=20
    ))

    return jsonify([_pub(u, me_id) for u in results]), 200


# ────────────────────────────────────────────────────────────────────────────
# GET /api/users/:id
# ────────────────────────────────────────────────────────────────────────────
@users_bp.route("/users/<user_id>", methods=["GET"])
@jwt_required()
def get_user_profile(user_id):
    me_id = get_jwt_identity()
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return jsonify({"error": "ID invalide"}), 400

    if not user:
        return jsonify({"error": "Utilisateur introuvable"}), 404

    return jsonify(_pub(user, me_id)), 200


# ────────────────────────────────────────────────────────────────────────────
# GET /api/users/:id/friends
# ────────────────────────────────────────────────────────────────────────────
@users_bp.route("/users/<user_id>/friends", methods=["GET"])
@jwt_required()
def get_user_friends(user_id):
    me_id = get_jwt_identity()
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return jsonify({"error": "ID invalide"}), 400

    if not user:
        return jsonify({"error": "Utilisateur introuvable"}), 404

    friends_ids = user.get("friends", [])
    friends = []
    for fid in friends_ids:
        try:
            f = users_collection.find_one({"_id": ObjectId(fid)})
            if f:
                friends.append(_pub(f, me_id))
        except Exception:
            continue

    return jsonify(friends), 200


# ────────────────────────────────────────────────────────────────────────────
# POST /api/friends/request/:id  →  envoyer une demande d'ami
# ────────────────────────────────────────────────────────────────────────────
@users_bp.route("/friends/request/<target_id>", methods=["POST"])
@jwt_required()
def send_friend_request(target_id):
    me_id = get_jwt_identity()

    if me_id == target_id:
        return jsonify({"error": "Impossible de vous ajouter vous-même"}), 400

    try:
        target = users_collection.find_one({"_id": ObjectId(target_id)})
    except Exception:
        return jsonify({"error": "ID invalide"}), 400

    if not target:
        return jsonify({"error": "Utilisateur introuvable"}), 404

    if me_id in target.get("friend_requests_received", []):
        return jsonify({"error": "Demande déjà envoyée"}), 400
    if me_id in target.get("friends", []):
        return jsonify({"error": "Déjà amis"}), 400

    # Ajouter la demande
    users_collection.update_one(
        {"_id": ObjectId(target_id)},
        {"$addToSet": {"friend_requests_received": me_id}}
    )
    users_collection.update_one(
        {"_id": ObjectId(me_id)},
        {"$addToSet": {"friend_requests_sent": target_id}}
    )

    # ── Notification → destinataire ──────────────────────────────────────────
    me = users_collection.find_one({"_id": ObjectId(me_id)})
    create_notification(
        to_user_id=target_id,
        type="friend_request",
        title="Nouvelle demande d'ami",
        body=f"{me.get('name', 'Quelqu\'un')} veut vous ajouter comme ami",
        from_user_id=me_id,
        from_name=me.get("name", ""),
        from_photo=me.get("photo", ""),
    )

    return jsonify({"message": "Demande envoyée"}), 200


# ────────────────────────────────────────────────────────────────────────────
# POST /api/friends/accept/:id  →  accepter une demande d'ami
# ────────────────────────────────────────────────────────────────────────────
@users_bp.route("/friends/accept/<sender_id>", methods=["POST"])
@jwt_required()
def accept_friend(sender_id):
    me_id = get_jwt_identity()

    me = users_collection.find_one({"_id": ObjectId(me_id)})
    if sender_id not in me.get("friend_requests_received", []):
        return jsonify({"error": "Aucune demande de cet utilisateur"}), 400

    # Ajouter comme amis (les deux sens)
    users_collection.update_one(
        {"_id": ObjectId(me_id)},
        {
            "$addToSet": {"friends": sender_id},
            "$pull"    : {"friend_requests_received": sender_id}
        }
    )
    users_collection.update_one(
        {"_id": ObjectId(sender_id)},
        {
            "$addToSet": {"friends": me_id},
            "$pull"    : {"friend_requests_sent": me_id}
        }
    )

    # ── Notification → celui qui avait envoyé la demande ────────────────────
    create_notification(
        to_user_id=sender_id,
        type="friend_accept",
        title="Demande d'ami acceptée",
        body=f"{me.get('name', 'Quelqu\'un')} a accepté votre demande d'ami",
        from_user_id=me_id,
        from_name=me.get("name", ""),
        from_photo=me.get("photo", ""),
    )

    return jsonify({"message": "Ami ajouté"}), 200


# ────────────────────────────────────────────────────────────────────────────
# POST /api/friends/decline/:id
# ────────────────────────────────────────────────────────────────────────────
@users_bp.route("/friends/decline/<sender_id>", methods=["POST"])
@jwt_required()
def decline_friend(sender_id):
    me_id = get_jwt_identity()

    users_collection.update_one(
        {"_id": ObjectId(me_id)},
        {"$pull": {"friend_requests_received": sender_id}}
    )
    users_collection.update_one(
        {"_id": ObjectId(sender_id)},
        {"$pull": {"friend_requests_sent": me_id}}
    )

    return jsonify({"message": "Demande refusée"}), 200


# ────────────────────────────────────────────────────────────────────────────
# DELETE /api/friends/:id
# ────────────────────────────────────────────────────────────────────────────
@users_bp.route("/friends/<friend_id>", methods=["DELETE"])
@jwt_required()
def remove_friend(friend_id):
    me_id = get_jwt_identity()

    users_collection.update_one(
        {"_id": ObjectId(me_id)},
        {"$pull": {"friends": friend_id}}
    )
    users_collection.update_one(
        {"_id": ObjectId(friend_id)},
        {"$pull": {"friends": me_id}}
    )

    return jsonify({"message": "Ami supprimé"}), 200


# ────────────────────────────────────────────────────────────────────────────
# GET /api/friends/requests
# ────────────────────────────────────────────────────────────────────────────
@users_bp.route("/friends/requests", methods=["GET"])
@jwt_required()
def get_friend_requests():
    me_id = get_jwt_identity()
    me    = users_collection.find_one({"_id": ObjectId(me_id)})

    received_ids = me.get("friend_requests_received", [])
    requests = []
    for uid in received_ids:
        try:
            u = users_collection.find_one({"_id": ObjectId(uid)})
            if u:
                requests.append(_pub(u, me_id))
        except Exception:
            continue

    return jsonify(requests), 200