from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from routes.auth import auth_bp
from routes.conversation import conv_bp
from routes.predict import predict_bp
from routes.predict_word import predict_word_bp
from routes.stats import stats_bp
from routes.users import users_bp
from routes.chat import chat_bp
from routes.notifications import notifications_bp
from model_loader import load_model, load_word_model
from datetime import timedelta
from routes.posts import posts_bp
import os

load_dotenv()

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

app.config["JWT_SECRET_KEY"]           = os.getenv("JWT_SECRET_KEY")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)

jwt = JWTManager(app)

@jwt.unauthorized_loader
def unauthorized_response(callback):
    return jsonify({"error": "Token manquant ou invalide"}), 401

@jwt.expired_token_loader
def expired_token_response(jwt_header, jwt_payload):
    return jsonify({"error": "Token expiré — reconnectez-vous"}), 401

@jwt.invalid_token_loader
def invalid_token_response(callback):
    return jsonify({"error": "Token invalide"}), 401

print("Chargement du modèle alphabet ASL...")
model = load_model()

print("Chargement du modèle mots WLASL...")
word_model, index_to_word = load_word_model()

app.config["WORD_MODEL"]    = word_model
app.config["INDEX_TO_WORD"] = index_to_word

app.register_blueprint(auth_bp,            url_prefix="/api/auth")
app.register_blueprint(conv_bp,            url_prefix="/api/conv")
app.register_blueprint(predict_bp,         url_prefix="/api")
app.register_blueprint(predict_word_bp,    url_prefix="/api")
app.register_blueprint(stats_bp,           url_prefix="/api")
app.register_blueprint(users_bp,           url_prefix="/api")
app.register_blueprint(chat_bp,            url_prefix="/api")
app.register_blueprint(notifications_bp,   url_prefix="/api")   # ← nouveau
app.register_blueprint(posts_bp, url_prefix="/api")

@app.route("/health")
def health():
    return jsonify({"status": "Backend en marche ✅"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)