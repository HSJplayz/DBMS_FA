from flask import Blueprint, request, jsonify
from db.connect import connectDb
from routes.auth import get_current_user
import traceback

bookmarks_bp = Blueprint("bookmarks_bp", __name__)


# ─── GET /api/bookmarks (user's saved recipes) ───────────────────────────
@bookmarks_bp.route("/api/bookmarks")
def get_bookmarks():
    payload, err = get_current_user()
    if err:
        return jsonify({"error": err}), 401
    user_id = payload["user_id"]

    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()
        cur.execute(
            """SELECT r.id, r.name, r.image_url, b.created_at
               FROM bookmarks b
               JOIN recipe r ON b.recipe_id = r.id
               WHERE b.user_id = %s
               ORDER BY b.created_at DESC""",
            (user_id,)
        )
        meals = []
        for row in cur.fetchall():
            meals.append({
                "id": row[0], "name": row[1],
                "image_url": row[2] or "", "saved_at": str(row[3])
            })
        return jsonify({"bookmarks": meals})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        con.close()


# ─── POST /api/bookmarks/<recipe_id> (toggle bookmark) ───────────────────
@bookmarks_bp.route("/api/bookmarks/<int:recipe_id>", methods=["POST"])
def toggle_bookmark(recipe_id):
    payload, err = get_current_user()
    if err:
        return jsonify({"error": err}), 401
    user_id = payload["user_id"]

    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()
        # Check if already bookmarked
        cur.execute(
            "SELECT id FROM bookmarks WHERE user_id = %s AND recipe_id = %s",
            (user_id, recipe_id)
        )
        existing = cur.fetchone()
        if existing:
            cur.execute("DELETE FROM bookmarks WHERE id = %s", (existing[0],))
            con.commit()
            return jsonify({"bookmarked": False, "message": "Bookmark removed"})
        else:
            cur.execute(
                "INSERT INTO bookmarks (user_id, recipe_id) VALUES (%s, %s)",
                (user_id, recipe_id)
            )
            con.commit()
            return jsonify({"bookmarked": True, "message": "Recipe saved!"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        con.close()


# ─── GET /api/bookmarks/check/<recipe_id> ────────────────────────────────
@bookmarks_bp.route("/api/bookmarks/check/<int:recipe_id>")
def check_bookmark(recipe_id):
    payload, err = get_current_user()
    if err:
        return jsonify({"bookmarked": False})
    user_id = payload["user_id"]

    con = connectDb()
    if not con:
        return jsonify({"bookmarked": False})
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT id FROM bookmarks WHERE user_id = %s AND recipe_id = %s",
            (user_id, recipe_id)
        )
        return jsonify({"bookmarked": cur.fetchone() is not None})
    except Exception:
        return jsonify({"bookmarked": False})
    finally:
        cur.close()
        con.close()
