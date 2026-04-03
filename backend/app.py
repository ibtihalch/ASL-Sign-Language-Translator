from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from routes.auth import auth_bp
from routes.conversation import conv_bp
from routes.predict import predict_bp
from model_loader import load_model
from datetime import timedelta
import os

load_dotenv()

app = Flask(__name__)

# ─── CORS ────────────────────────────────────────────────
CORS(app, resources={r"/*": {"origins": "*"}},
     supports_credentials=True)

# ─── JWT config ──────────────────────────────────────────
app.config["JWT_SECRET_KEY"]            = os.getenv("JWT_SECRET_KEY")
app.config["JWT_ACCESS_TOKEN_EXPIRES"]  = timedelta(hours=24)

jwt = JWTManager(app)

# ─── Erreurs JWT personnalisées ───────────────────────────
@jwt.unauthorized_loader
def unauthorized_response(callback):
    return jsonify({"error": "Token manquant ou invalide"}), 401

@jwt.expired_token_loader
def expired_token_response(jwt_header, jwt_payload):
    return jsonify({"error": "Token expiré — reconnectez-vous"}), 401

@jwt.invalid_token_loader
def invalid_token_response(callback):
    return jsonify({"error": "Token invalide"}), 401

# ─── Charger le modèle ───────────────────────────────────
print("Chargement du modèle ASL...")
model = load_model()

# ─── Blueprints ──────────────────────────────────────────
app.register_blueprint(auth_bp,    url_prefix="/api/auth")
app.register_blueprint(conv_bp,    url_prefix="/api/conv")
app.register_blueprint(predict_bp, url_prefix="/api")      # ✅ Fix CORS

@app.route("/health")
def health():
    return jsonify({"status": "Backend en marche ✅"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)