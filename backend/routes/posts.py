from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import users_collection, posts_collection

posts_bp = Blueprint("posts", __name__)


def _create_notif(to_user_id, ntype, title, body, from_user_id, from_name, from_photo=""):
    try:
        from routes.notifications import create_notification
        create_notification(
            to_user_id   = str(to_user_id),
            type         = ntype,
            title        = title,
            body         = body,
            from_user_id = str(from_user_id),
            from_name    = from_name,
            from_photo   = from_photo or "",
        )
    except Exception as e:
        print(f"[NOTIF ERROR] {e}")


def _fmt_post(post, me_id=None):
    likes       = post.get("likes", [])
    likes_ids   = [str(l) for l in likes]
    liked_by_me = str(me_id) in likes_ids if me_id else False
    ts = post.get("created_at", datetime.utcnow())
    return {
        "_id"           : str(post["_id"]),
        "user_id"       : str(post.get("user_id", "")),
        "author_name"   : post.get("author_name", ""),
        "author_photo"  : post.get("author_photo", ""),
        "content"       : post.get("content", ""),
        "media"         : post.get("media", ""),
        "type"          : post.get("type", "post"),
        "likes_count"   : len(likes),
        "liked_by_me"   : liked_by_me,
        "comments_count": len(post.get("comments", [])),
        "views_count"   : post.get("views_count", 0),
        "created_at"    : ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
    }


# ── GET /api/posts/feed?type=post|story ──────────────────────
# Retourne les posts/stories de l'utilisateur connecté + ses amis
@posts_bp.route("/posts/feed", methods=["GET"])
@jwt_required()
def get_feed():
    me_id = get_jwt_identity()
    ptype = request.args.get("type", "post")

    # Récupérer la liste d'amis depuis users
    me = users_collection.find_one({"_id": ObjectId(me_id)})
    if not me:
        return jsonify([]), 200

    friends_ids = me.get("friends", [])  # liste de strings

    # Construire la liste des user_ids à inclure (moi + amis)
    all_ids = [ObjectId(me_id)]
    for fid in friends_ids:
        try:
            all_ids.append(ObjectId(fid))
        except Exception:
            continue

    posts = list(posts_collection.find(
        {"user_id": {"$in": all_ids}, "type": ptype},
        sort=[("created_at", -1)],
        limit=50
    ))

    return jsonify([_fmt_post(p, me_id) for p in posts])


# ── GET /api/posts/user/<uid>?type=post|story ─────────────────
@posts_bp.route("/posts/user/<uid>", methods=["GET"])
@jwt_required()
def get_user_posts(uid):
    me_id = get_jwt_identity()
    ptype = request.args.get("type", "post")
    posts = list(posts_collection.find(
        {"user_id": ObjectId(uid), "type": ptype},
        sort=[("created_at", -1)]
    ))
    return jsonify([_fmt_post(p, me_id) for p in posts])


# ── POST /api/posts ───────────────────────────────────────────
@posts_bp.route("/posts", methods=["POST"])
@jwt_required()
def create_post():
    me_id = get_jwt_identity()
    me    = users_collection.find_one({"_id": ObjectId(me_id)})
    data  = request.get_json() or {}

    content = data.get("content", "").strip()
    media   = data.get("media", "")
    ptype   = data.get("type", "post")

    if not content and not media:
        return jsonify({"error": "Contenu vide"}), 400

    post = {
        "user_id"     : ObjectId(me_id),
        "author_name" : me.get("name", ""),
        "author_photo": me.get("photo", ""),
        "content"     : content,
        "media"       : media,
        "type"        : ptype,
        "likes"       : [],
        "comments"    : [],
        "views"       : [],
        "views_count" : 0,
        "created_at"  : datetime.utcnow(),
    }
    res = posts_collection.insert_one(post)
    return jsonify({"id": str(res.inserted_id), "message": "Créé"}), 201


# ── POST /api/posts/<post_id>/like ────────────────────────────
@posts_bp.route("/posts/<post_id>/like", methods=["POST"])
@jwt_required()
def toggle_like(post_id):
    me_id = get_jwt_identity()
    try:
        post = posts_collection.find_one({"_id": ObjectId(post_id)})
    except Exception:
        return jsonify({"error": "ID invalide"}), 400

    if not post:
        return jsonify({"error": "Post introuvable"}), 404

    likes_str = [str(l) for l in post.get("likes", [])]
    already   = me_id in likes_str

    if already:
        posts_collection.update_one(
            {"_id": ObjectId(post_id)},
            {"$pull": {"likes": ObjectId(me_id)}}
        )
        liked = False
    else:
        posts_collection.update_one(
            {"_id": ObjectId(post_id)},
            {"$addToSet": {"likes": ObjectId(me_id)}}
        )
        liked = True

        owner_id = str(post.get("user_id", ""))
        if owner_id and owner_id != me_id:
            me       = users_collection.find_one({"_id": ObjectId(me_id)})
            is_story = post.get("type") == "story"
            _create_notif(
                to_user_id   = owner_id,
                ntype        = "story_like" if is_story else "post_like",
                title        = "Nouveau j'aime sur votre story" if is_story else "Nouveau j'aime sur votre publication",
                body         = f"{me.get('name','Quelqu\'un')} a aimé votre {'story' if is_story else 'publication'}.",
                from_user_id = me_id,
                from_name    = me.get("name", ""),
                from_photo   = me.get("photo", ""),
            )

    updated   = posts_collection.find_one({"_id": ObjectId(post_id)})
    new_count = len(updated.get("likes", []))
    return jsonify({"liked": liked, "count": new_count})


# ── GET /api/posts/<post_id>/comments ────────────────────────
@posts_bp.route("/posts/<post_id>/comments", methods=["GET"])
@jwt_required()
def get_comments(post_id):
    post = posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        return jsonify([])
    comments = []
    for c in post.get("comments", []):
        ts = c.get("created_at", datetime.utcnow())
        comments.append({
            "id"          : str(c.get("_id", "")),
            "author_name" : c.get("user_name", ""),
            "author_photo": c.get("user_photo", ""),
            "author_id"   : str(c.get("user_id", "")),
            "text"        : c.get("text", ""),
            "created_at"  : ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
        })
    return jsonify(comments)


# ── POST /api/posts/<post_id>/comments ───────────────────────
@posts_bp.route("/posts/<post_id>/comments", methods=["POST"])
@jwt_required()
def add_comment(post_id):
    me_id = get_jwt_identity()
    data  = request.get_json() or {}
    text  = data.get("text", "").strip()

    if not text:
        return jsonify({"error": "Texte vide"}), 400

    try:
        post = posts_collection.find_one({"_id": ObjectId(post_id)})
    except Exception:
        return jsonify({"error": "ID invalide"}), 400

    if not post:
        return jsonify({"error": "Post introuvable"}), 404

    me = users_collection.find_one({"_id": ObjectId(me_id)})
    comment = {
        "_id"       : ObjectId(),
        "user_id"   : ObjectId(me_id),
        "user_name" : me.get("name", ""),
        "user_photo": me.get("photo", ""),
        "text"      : text,
        "created_at": datetime.utcnow(),
    }
    posts_collection.update_one({"_id": ObjectId(post_id)}, {"$push": {"comments": comment}})

    owner_id = str(post.get("user_id", ""))
    if owner_id and owner_id != me_id:
        is_story = post.get("type") == "story"
        preview  = text[:60] + ("…" if len(text) > 60 else "")
        _create_notif(
            to_user_id   = owner_id,
            ntype        = "story_comment" if is_story else "post_comment",
            title        = "Nouveau commentaire sur votre story" if is_story else "Nouveau commentaire sur votre publication",
            body         = f"{me.get('name','Quelqu\'un')} : {preview}",
            from_user_id = me_id,
            from_name    = me.get("name", ""),
            from_photo   = me.get("photo", ""),
        )

    return jsonify({
        "id"          : str(comment["_id"]),
        "author_id"   : me_id,
        "author_name" : me.get("name", ""),
        "author_photo": me.get("photo", ""),
        "text"        : text,
        "created_at"  : comment["created_at"].isoformat(),
    }), 201


# ── DELETE /api/posts/<post_id> ───────────────────────────────
@posts_bp.route("/posts/<post_id>", methods=["DELETE"])
@jwt_required()
def delete_post(post_id):
    me_id = get_jwt_identity()
    post  = posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        return jsonify({"error": "Post introuvable"}), 404
    if str(post.get("user_id", "")) != me_id:
        return jsonify({"error": "Non autorisé"}), 403
    posts_collection.delete_one({"_id": ObjectId(post_id)})
    return jsonify({"message": "Supprimé"})


# ── POST /api/posts/<post_id>/view ────────────────────────────
@posts_bp.route("/posts/<post_id>/view", methods=["POST"])
@jwt_required()
def record_view(post_id):
    me_id = get_jwt_identity()
    post  = posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        return jsonify({"error": "Post introuvable"}), 404

    views_str = [str(v) for v in post.get("views", [])]
    if me_id not in views_str:
        posts_collection.update_one(
            {"_id": ObjectId(post_id)},
            {"$addToSet": {"views": ObjectId(me_id)}, "$inc": {"views_count": 1}}
        )
    updated = posts_collection.find_one({"_id": ObjectId(post_id)})
    return jsonify({"views_count": updated.get("views_count", 0)})


# ── GET /api/posts/<post_id>/views ────────────────────────────
@posts_bp.route("/posts/<post_id>/views", methods=["GET"])
@jwt_required()
def get_views(post_id):
    post = posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        return jsonify([])
    viewers = []
    for uid in post.get("views", []):
        u = users_collection.find_one({"_id": ObjectId(str(uid))})
        if u:
            viewers.append({"id": str(u["_id"]), "name": u.get("name",""), "photo": u.get("photo","")})
    return jsonify(viewers)


# ── POST /api/posts/<post_id>/react ──────────────────────────
@posts_bp.route("/posts/<post_id>/react", methods=["POST"])
@jwt_required()
def react_to_post(post_id):
    me_id    = get_jwt_identity()
    data     = request.get_json() or {}
    reaction = data.get("reaction", "like")

    post = posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        return jsonify({"error": "Post introuvable"}), 404

    reactions = post.get("reactions", {})
    for rtype in list(reactions.keys()):
        reactions[rtype] = [str(u) for u in reactions.get(rtype, [])]
        if me_id in reactions[rtype]:
            reactions[rtype].remove(me_id)

    current = reactions.get(reaction, [])
    if me_id not in current:
        current.append(me_id)
        reactions[reaction] = current

    posts_collection.update_one({"_id": ObjectId(post_id)}, {"$set": {"reactions": reactions}})
    return jsonify({"reactions": reactions})


# ── GET /api/posts/<post_id>/reactions ───────────────────────
@posts_bp.route("/posts/<post_id>/reactions", methods=["GET"])
@jwt_required()
def get_reactions(post_id):
    post = posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        return jsonify({})

    result = {}
    for rtype, uids in post.get("reactions", {}).items():
        users_list = []
        for uid in uids:
            u = users_collection.find_one({"_id": ObjectId(str(uid))})
            if u:
                users_list.append({"id": str(u["_id"]), "name": u.get("name",""), "photo": u.get("photo","")})
        if users_list:
            result[rtype] = users_list
    return jsonify(result)