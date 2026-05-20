from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from config import users_collection
from datetime import datetime, timezone
from bson import ObjectId
from routes.notifications import create_notification
import math

stats_bp = Blueprint("stats", __name__)

# ── Collection MongoDB pour les stats ───────────────────────────────────────
from pymongo import MongoClient
import os
from dotenv import load_dotenv
load_dotenv()

client           = MongoClient(os.getenv("MONGO_URI"))
db               = client[os.getenv("MONGO_DB_NAME", "asl_db")]
stats_collection = db["stats"]


# ────────────────────────────────────────────────────────────────────────────
# GET /api/stats
# ────────────────────────────────────────────────────────────────────────────
@stats_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    user_id = get_jwt_identity()
    stats   = stats_collection.find_one({"user_id": user_id})

    if not stats:
        stats = _create_default_stats(user_id)

    stats.pop("_id", None)
    return jsonify(stats), 200


# ────────────────────────────────────────────────────────────────────────────
# POST /api/stats/watch
# ────────────────────────────────────────────────────────────────────────────
@stats_bp.route("/stats/watch", methods=["POST"])
@jwt_required()
def mark_watched():
    user_id   = get_jwt_identity()
    data      = request.get_json()
    lesson_id = str(data.get("lesson_id"))

    now   = datetime.now(timezone.utc)
    stats = stats_collection.find_one({"user_id": user_id})
    if not stats:
        stats = _create_default_stats(user_id)

    watched = stats.get("lessons_watched", [])
    if lesson_id not in watched:
        watched.append(lesson_id)

    xp_bonus = 0
    if lesson_id not in stats.get("lessons_watched", []):
        xp_bonus = 5
        new_xp   = stats.get("xp", 0) + xp_bonus
        new_level = math.floor(new_xp / 100) + 1
    else:
        new_xp    = stats.get("xp", 0)
        new_level = stats.get("level", 1)

    stats_collection.update_one(
        {"user_id": user_id},
        {"$set": {
            "lessons_watched": watched,
            "last_activity"  : now.isoformat(),
            "xp"             : new_xp,
            "level"          : new_level,
        }},
        upsert=True
    )
    return jsonify({"watched": watched, "xp_bonus": xp_bonus, "new_xp": new_xp}), 200


# ────────────────────────────────────────────────────────────────────────────
# POST /api/stats/quiz
# ────────────────────────────────────────────────────────────────────────────
@stats_bp.route("/stats/quiz", methods=["POST"])
@jwt_required()
def submit_quiz():
    user_id = get_jwt_identity()
    data    = request.get_json()

    lesson_id = str(data.get("lesson_id"))
    correct   = int(data.get("correct", 0))
    total     = int(data.get("total", 1))

    xp_earned = correct * 10
    if correct == total:
        xp_earned += 20

    progress = math.floor((correct / total) * 100)

    now   = datetime.now(timezone.utc)
    stats = stats_collection.find_one({"user_id": user_id})
    if not stats:
        stats = _create_default_stats(user_id)

    # ── Streak ──
    streak = stats.get("streak", 0)
    last   = stats.get("last_activity")
    if last:
        if isinstance(last, str):
            last = datetime.fromisoformat(last)
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        diff = (now.date() - last.date()).days
        if diff == 0:
            pass
        elif diff == 1:
            streak += 1
        else:
            streak = 1
    else:
        streak = 1

    new_xp    = stats.get("xp", 0) + xp_earned
    new_level = math.floor(new_xp / 100) + 1

    lessons_progress = stats.get("lessons_progress", {})
    old_progress     = lessons_progress.get(lesson_id, 0)
    lessons_progress[lesson_id] = max(old_progress, progress)

    quiz_history = stats.get("quiz_history", {})
    if lesson_id not in quiz_history:
        quiz_history[lesson_id] = []
    quiz_history[lesson_id].append({
        "date"   : now.isoformat(),
        "correct": correct,
        "total"  : total,
        "score"  : progress,
    })
    quiz_history[lesson_id] = quiz_history[lesson_id][-5:]

    lessons_completed = stats.get("lessons_completed", [])
    if progress == 100 and lesson_id not in lessons_completed:
        lessons_completed.append(lesson_id)

    # ── Badges : détecter les nouveaux ──
    old_badges = stats.get("badges", [])
    new_badges = _check_badges(old_badges, new_xp, streak, len(lessons_completed))
    newly_unlocked = [b for b in new_badges if b["id"] not in [x["id"] for x in old_badges]]

    # ── Update MongoDB ──
    update = {
        "xp"               : new_xp,
        "level"            : new_level,
        "streak"           : streak,
        "last_activity"    : now.isoformat(),
        "lessons_progress" : lessons_progress,
        "lessons_completed": lessons_completed,
        "quiz_history"     : quiz_history,
        "total_quizzes"    : stats.get("total_quizzes", 0) + 1,
        "correct_answers"  : stats.get("correct_answers", 0) + correct,
        "badges"           : new_badges,
    }
    stats_collection.update_one(
        {"user_id": user_id},
        {"$set": update},
        upsert=True
    )

    # ── Notification quiz complété ───────────────────────────────────────────
    if correct == total:
        body = f"Score parfait ! 🎯 +{xp_earned} XP gagnés"
    else:
        body = f"{correct}/{total} bonnes réponses · +{xp_earned} XP gagnés"

    create_notification(
        to_user_id=user_id,
        type="quiz",
        title="Quiz complété ⭐",
        body=body,
    )

    # ── Notification badge débloqué ──────────────────────────────────────────
    for badge in newly_unlocked:
        create_notification(
            to_user_id=user_id,
            type="badge",
            title="Nouveau badge débloqué ! 🏆",
            body=badge["label"],
        )

    return jsonify({
        "xp_earned"      : xp_earned,
        "new_xp"         : new_xp,
        "new_level"      : new_level,
        "streak"         : streak,
        "progress"       : progress,
        "perfect"        : correct == total,
        "badges"         : new_badges,
        "newly_unlocked" : newly_unlocked,
        "best_score"     : lessons_progress[lesson_id],
    }), 200


# ────────────────────────────────────────────────────────────────────────────
# GET /api/stats/leaderboard
# ────────────────────────────────────────────────────────────────────────────
@stats_bp.route("/stats/leaderboard", methods=["GET"])
def leaderboard():
    top = list(
        stats_collection.find(
            {"xp": {"$gt": 0}},
            {"user_id": 1, "xp": 1, "level": 1, "streak": 1}
        )
        .sort("xp", -1)
        .limit(10)
    )

    result = []
    for s in top:
        try:
            user = users_collection.find_one({"_id": ObjectId(s["user_id"])})
        except Exception:
            user = None
        if user:
            result.append({
                "name"  : user.get("name", "Inconnu"),
                "photo" : user.get("photo", ""),
                "xp"    : s.get("xp", 0),
                "level" : s.get("level", 1),
                "streak": s.get("streak", 0),
            })

    return jsonify(result), 200


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────
def _create_default_stats(user_id):
    default = {
        "user_id"          : user_id,
        "xp"               : 0,
        "level"            : 1,
        "streak"           : 0,
        "last_activity"    : None,
        "lessons_completed": [],
        "lessons_progress" : {},
        "lessons_watched"  : [],
        "quiz_history"     : {},
        "total_quizzes"    : 0,
        "correct_answers"  : 0,
        "badges"           : [],
    }
    stats_collection.insert_one(default)
    default.pop("_id", None)
    return default


def _check_badges(badges, xp, streak, completed):
    new_badges = list(badges)

    badge_rules = [
        {"id": "first_quiz",  "label": "First Quiz! 🎉",      "condition": lambda: True},
        {"id": "streak_3",    "label": "3 Day Streak 🔥",      "condition": lambda: streak >= 3},
        {"id": "streak_7",    "label": "Week Warrior 🗓️",      "condition": lambda: streak >= 7},
        {"id": "xp_100",      "label": "100 XP ⭐",             "condition": lambda: xp >= 100},
        {"id": "xp_500",      "label": "500 XP 🌟",             "condition": lambda: xp >= 500},
        {"id": "lesson_1",    "label": "First Lesson ✅",       "condition": lambda: completed >= 1},
        {"id": "lesson_5",    "label": "5 Lessons Done 🏅",     "condition": lambda: completed >= 5},
        {"id": "lesson_10",   "label": "10 Lessons Master 🏆",  "condition": lambda: completed >= 10},
    ]

    for rule in badge_rules:
        if rule["id"] not in [b["id"] for b in new_badges]:
            if rule["condition"]():
                new_badges.append({"id": rule["id"], "label": rule["label"]})

    return new_badges