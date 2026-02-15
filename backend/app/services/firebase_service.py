import os
import firebase_admin
from firebase_admin import credentials, firestore

_db = None


def initialize_firebase():
    global _db
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "./firebase-service-account-key.json")

    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {
            "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        })

    _db = firestore.client()
    print("[Firebase] Initialized successfully")


def get_firestore_client():
    global _db
    if _db is None:
        initialize_firebase()
    return _db
