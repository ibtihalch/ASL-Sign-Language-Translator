from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from backend.routes.auth import auth_bp
from backend.routes.conversation import conv_bp
from backend.routes.predict import predict_bp
from backend.routes.realtime_asl import realtime_asl_bp
from backend.model_loader import load_model
from datetime import timedelta
import os

load_dotenv()

app = Flask(__name__)

# ─── CORS ────────────────────────────────────────────────
CORS(
    app,
    resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)

# ─── JWT config ──────────────────────────────────────────
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

# ─── Load model ONCE and store on app ────────────────────
# load_model() returns (model, idx_to_word) — store both
print("Chargement du modèle ASL...")
asl_model, asl_idx_to_word = load_model()
app.config["ASL_MODEL"]       = asl_model
app.config["ASL_IDX_TO_WORD"] = asl_idx_to_word
print(f"✅ Model loaded — {len(asl_idx_to_word)} words")

# ─── Blueprints ──────────────────────────────────────────
app.register_blueprint(auth_bp,         url_prefix="/api/auth")
app.register_blueprint(conv_bp,         url_prefix="/api/conv")
app.register_blueprint(predict_bp,      url_prefix="/api")
app.register_blueprint(realtime_asl_bp, url_prefix="/api/asl/realtime")

@app.route("/health")
def health():
    return jsonify({"status": "Backend en marche ✅"})

if __name__ == "__main__":
    print("Starting Flask server...")
    app.run(debug=True, port=5000)