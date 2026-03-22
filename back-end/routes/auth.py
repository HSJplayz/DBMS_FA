from flask import Blueprint, request, jsonify
from db.connect import connectDb
from mysql.connector import Error
import bcrypt
import jwt
import datetime
import os

auth_bp = Blueprint("auth_bp", __name__)

SECRET_KEY = os.environ.get("SECRET_KEY", "spiceroute_secret_2026")


def make_token(user_id: int, is_admin: int) -> str:
    payload = {
        "user_id": user_id,
        "is_admin": bool(is_admin),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token: str):
    """Returns payload dict or raises an exception."""
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])


def get_current_user():
    """Helper: extract and verify Bearer token from request headers."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, "No token provided"
    token = auth_header.split(" ", 1)[1]
    try:
        payload = decode_token(token)
        return payload, None
    except jwt.ExpiredSignatureError:
        return None, "Token expired"
    except jwt.InvalidTokenError:
        return None, "Invalid token"


# ─── POST /auth/signup ────────────────────────────────────────────────────────

@auth_bp.route("/auth/signup", methods=["POST"])
def signup():
    data = request.get_json()
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()
        cur.execute(
            "INSERT INTO users (name, email, password, is_admin) VALUES (%s, %s, %s, 0)",
            (name, email, hashed)
        )
        con.commit()
        user_id = cur.lastrowid
        token = make_token(user_id, 0)
        return jsonify({
            "message": "Account created!",
            "token": token,
            "user": {"id": user_id, "name": name, "email": email, "is_admin": False}
        }), 201
    except Error as e:
        if "Duplicate entry" in str(e):
            return jsonify({"error": "Email already registered"}), 409
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); con.close()


# ─── POST /auth/login ─────────────────────────────────────────────────────────

@auth_bp.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT id, name, email, password, is_admin FROM users WHERE email = %s",
            (email,)
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Invalid email or password"}), 401

        user_id, name, db_email, hashed, is_admin = row
        if not bcrypt.checkpw(password.encode(), hashed.encode()):
            return jsonify({"error": "Invalid email or password"}), 401

        token = make_token(user_id, is_admin)
        return jsonify({
            "message": "Login successful!",
            "token": token,
            "user": {
                "id": user_id,
                "name": name,
                "email": db_email,
                "is_admin": bool(is_admin)
            }
        }), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); con.close()


# ─── GET /auth/me ─────────────────────────────────────────────────────────────

@auth_bp.route("/auth/me", methods=["GET"])
def me():
    payload, err = get_current_user()
    if err:
        return jsonify({"error": err}), 401
    return jsonify({"user_id": payload["user_id"], "is_admin": payload["is_admin"]}), 200
