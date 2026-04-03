from flask import Blueprint, request, jsonify
from config import users_collection, messages_collection
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import bcrypt
from datetime import datetime
from bson import ObjectId
import base64
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

auth_bp = Blueprint("auth", __name__)
GOOGLE_CLIENT_ID = "448391805293-cfbgh0o6qamuc3uh4djeifa28qpkpd7u.apps.googleusercontent.com"
@auth_bp.route("/google", methods=["POST"])
def google_login():
    data  = request.get_json()
    token = data.get("credential")

    try:
        info = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
    except ValueError:
        return jsonify({"error": "Token Google invalide"}), 401

    email = info.get("email")
    name  = info.get("name", "")
    photo = info.get("picture", "")

    user = users_collection.find_one({"email": email})

    if not user:
        result = users_collection.insert_one({
            "name"           : name,
            "email"          : email,
            "password"       : b"",
            "role"           : "hearing",
            "photo"          : photo,
            "created_at"     : datetime.utcnow(),
            "birth_date"     : "",
            "phone"          : "",
            "city"           : "",
            "country"        : "",
            "theme"          : "dark",
            "language"       : "fr",
            "asl_level"      : "beginner",
            "disability_type": "",
            "hearing_device" : False,
            "bio"            : "",
            "google_auth"    : True,
        })
        user = users_collection.find_one({"_id": result.inserted_id})

    token_jwt = create_access_token(identity=str(user["_id"]))

    return jsonify({
        "token": token_jwt,
        "user" : {
            "name"    : user["name"],
            "email"   : user["email"],
            "role"    : user["role"],
            "theme"   : user.get("theme", "dark"),
            "language": user.get("language", "fr"),
            "photo"   : user.get("photo", ""),
        }
    }), 200




# ─── Inscription ──────────────────────────────────────────
@auth_bp.route("/register", methods=["POST"])
def register():
    data     = request.get_json()
    name     = data.get("name")
    email    = data.get("email")
    password = data.get("password")
    role     = data.get("role", "hearing_impaired")

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "Email déjà utilisé"}), 400

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    users_collection.insert_one({
        "name"          : name,
        "email"         : email,
        "password"      : hashed,
        "role"          : role,
        "created_at"    : datetime.utcnow(),
        # Champs profil
        "photo"         : "",
        "birth_date"    : "",
        "phone"         : "",
        "city"          : "",
        "country"       : "",
        "theme"         : "dark",
        "language"      : "fr",
        "asl_level"     : "beginner",
        "disability_type": "",
        "hearing_device": False,
        "bio"           : "",
    })
    return jsonify({"message": "Inscription réussie ✅"}), 201


# ─── Connexion ────────────────────────────────────────────
@auth_bp.route("/login", methods=["POST"])
def login():
    data     = request.get_json()
    email    = data.get("email")
    password = data.get("password")

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "Utilisateur non trouvé"}), 404

    if not bcrypt.checkpw(password.encode("utf-8"), user["password"]):
        return jsonify({"error": "Mot de passe incorrect"}), 401

    token = create_access_token(identity=str(user["_id"]))
    return jsonify({
        "token": token,
        "user" : {
            "name"          : user["name"],
            "email"         : user["email"],
            "role"          : user["role"],
            "theme"         : user.get("theme", "dark"),
            "language"      : user.get("language", "fr"),
            "photo"         : user.get("photo", ""),
        }
    }), 200


# ─── Récupérer le profil ──────────────────────────────────
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user    = users_collection.find_one({"_id": ObjectId(user_id)})

    if not user:
        return jsonify({"error": "Utilisateur non trouvé"}), 404

    # Statistiques
    total_messages = messages_collection.count_documents({"user_id": user_id})
    total_asl      = messages_collection.count_documents({"user_id": user_id, "type": "asl"})
    total_speech   = messages_collection.count_documents({"user_id": user_id, "type": "speech"})

    return jsonify({
        "name"           : user.get("name", ""),
        "email"          : user.get("email", ""),
        "role"           : user.get("role", "hearing_impaired"),
        "photo"          : user.get("photo", ""),
        "birth_date"     : user.get("birth_date", ""),
        "phone"          : user.get("phone", ""),
        "city"           : user.get("city", ""),
        "country"        : user.get("country", ""),
        "theme"          : user.get("theme", "dark"),
        "language"       : user.get("language", "fr"),
        "asl_level"      : user.get("asl_level", "beginner"),
        "disability_type": user.get("disability_type", ""),
        "hearing_device" : user.get("hearing_device", False),
        "bio"            : user.get("bio", ""),
        "created_at"     : user.get("created_at", datetime.utcnow()).isoformat(),
        "stats"          : {
            "total_messages": total_messages,
            "total_asl"     : total_asl,
            "total_speech"  : total_speech,
        }
    }), 200


# ─── Modifier le profil ───────────────────────────────────
@auth_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    data    = request.get_json()

    allowed = [
        "name", "photo", "birth_date", "phone",
        "city", "country", "theme", "language",
        "asl_level", "disability_type", "hearing_device", "bio"
    ]

    update = {}
    for field in allowed:
        if field in data:
            update[field] = data[field]

    if not update:
        return jsonify({"error": "Aucun champ à mettre à jour"}), 400

    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update}
    )

    # Retourner le profil mis à jour
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    return jsonify({
        "message": "Profil mis à jour ✅",
        "user"   : {
            "name"    : user.get("name", ""),
            "email"   : user.get("email", ""),
            "role"    : user.get("role", ""),
            "theme"   : user.get("theme", "dark"),
            "language": user.get("language", "fr"),
            "photo"   : user.get("photo", ""),
        }
    }), 200


# ─── Changer le mot de passe ──────────────────────────────
@auth_bp.route("/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    user_id      = get_jwt_identity()
    data         = request.get_json()
    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "")

    if not old_password or not new_password:
        return jsonify({"error": "Champs manquants"}), 400

    if len(new_password) < 6:
        return jsonify({"error": "Mot de passe trop court (6 caractères min)"}), 400

    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "Utilisateur non trouvé"}), 404

    if not bcrypt.checkpw(old_password.encode("utf-8"), user["password"]):
        return jsonify({"error": "Ancien mot de passe incorrect"}), 401

    hashed = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt())
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": hashed}}
    )

    return jsonify({"message": "Mot de passe changé ✅"}), 200