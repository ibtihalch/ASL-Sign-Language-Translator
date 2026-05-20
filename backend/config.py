# config.py
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
db     = client["asl_db"]

# Collections
users_collection    = db["users"]
messages_collection = db["messages"]
posts_collection    = db["posts"]   # ← ajouter ça