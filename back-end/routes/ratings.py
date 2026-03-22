from flask import Blueprint, request, jsonify
from db.connect import connectDb
from mysql.connector import Error
import traceback

ratings_bp = Blueprint("ratings_bp", __name__)


# ─── GET /api/ratings/<recipe_id> ──────────────────────────────────────────
@ratings_bp.route("/api/ratings/<int:recipe_id>")
def get_ratings(recipe_id):
    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()
        cur.execute(
            """SELECT r.id, r.stars, r.review_text, r.reviewer_name, r.created_at,
                      r.user_id
               FROM ratings r WHERE r.recipe_id = %s
               ORDER BY r.created_at DESC""",
            (recipe_id,)
        )
        rows = cur.fetchall()
        reviews = []
        for row in rows:
            reviews.append({
                "id": row[0], "stars": row[1], "text": row[2] or "",
                "name": row[3] or "Anonymous", "created_at": str(row[4]),
                "user_id": row[5]
            })
        # Average
        cur.execute(
            "SELECT AVG(stars), COUNT(*) FROM ratings WHERE recipe_id = %s",
            (recipe_id,)
        )
        avg_row = cur.fetchone()
        avg = round(avg_row[0], 1) if avg_row[0] else 0
        count = avg_row[1] or 0
        return jsonify({"reviews": reviews, "avg_stars": avg, "count": count})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        con.close()


# ─── POST /api/ratings/<recipe_id> (anyone can rate) ──────────────────────
@ratings_bp.route("/api/ratings/<int:recipe_id>", methods=["POST"])
def post_rating(recipe_id):
    data = request.get_json() or {}
    stars = data.get("stars")
    review_text = (data.get("text") or "").strip()
    reviewer_name = (data.get("name") or "Anonymous").strip()[:100]

    if not stars or not (1 <= int(stars) <= 5):
        return jsonify({"error": "Stars must be between 1 and 5"}), 400

    # Check if logged in (optional)
    user_id = None
    try:
        from routes.auth import get_current_user
        payload, err = get_current_user()
        if not err:
            user_id = payload.get("user_id")
            # Use the user's actual name if logged in
            con2 = connectDb()
            if con2:
                cur2 = con2.cursor()
                cur2.execute("SELECT name FROM users WHERE id = %s", (user_id,))
                urow = cur2.fetchone()
                if urow:
                    reviewer_name = urow[0]
                cur2.close()
                con2.close()
    except Exception:
        pass

    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()
        cur.execute(
            """INSERT INTO ratings (recipe_id, user_id, reviewer_name, stars, review_text)
               VALUES (%s, %s, %s, %s, %s)""",
            (recipe_id, user_id, reviewer_name, int(stars), review_text)
        )
        con.commit()
        return jsonify({"message": "Review submitted!"}), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        con.close()


# ─── DELETE /api/ratings/<rating_id> (admin only) ─────────────────────────
@ratings_bp.route("/api/ratings/<int:rating_id>/delete", methods=["DELETE"])
def delete_rating(rating_id):
    from routes.auth import get_current_user
    payload, err = get_current_user()
    if err:
        return jsonify({"error": err}), 401
    if not payload.get("is_admin"):
        return jsonify({"error": "Admin access required"}), 403

    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()
        cur.execute("DELETE FROM ratings WHERE id = %s", (rating_id,))
        con.commit()
        return jsonify({"message": "Review deleted"}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        con.close()
