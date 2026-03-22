from flask import jsonify, request
from db.connect import connectDb
from mysql.connector import Error
from routes.tableBluePrint import tables_bp
from routes.pexels_service import fetch_image_from_pexels
import threading
import random
import re
import hashlib
from datetime import date
import traceback

# ─── New robust ingredient cleaner ─────────────────────────────────────────

_UNITS = [
    r'teaspoons?', r'teas?', r'tsp\.?', r'tbsp\.?', r'tablespoons?', r'cups?', r'oz\.?', r'grams?', r'g', r'kg', r'ml', 
    r'lbs?\.?', r'pounds?', r'pkg\.?', r'can', r'cloves?', r'bits', r'units?', r'fl\.? oz\.?', r'quart', r'qt\.?', 
    r'pint', r'pt\.?', r'inches?', r'in\.?', r'piece', r'lb\.?', r'oz\.?', r'clove', r'can', r'bag', r'bottle', 
    r'dash', r'pinch', r'bunch', r'sprig', r'lb\s*box'
]
_UNITS_RE = re.compile(r'\b(' + '|'.join(_UNITS) + r')\b', re.IGNORECASE)

def _clean_ingredient(name):
    """Repair/Extract core ingredient name from noisy dataset entry."""
    if not name: return None
    n = name.strip()
    # 1. Strip common prefix junk 'a\t', 'A - ', 'A ', etc.
    n = re.sub(r'^[a-zA-Z][\t\-\s\'\"]+\s*', '', n)
    # 2. Strip leading numbers/fractions
    n = re.sub(r'^[0-9\s\/\.xX\-]+', ' ', n).strip()
    # 3. Strip units
    n = _UNITS_RE.sub(' ', n).strip()
    # 4. Strip everything after many common separators or parentheticals
    n = n.split(',')[0].split(';')[0].strip()
    n = re.sub(r'\s*\(.*?\)', '', n).strip()
    
    # 5. Clean up remaining junk prefixes (including A/An)
    # This also handles repeats to catch ones like "Fresh Fresh Garlic"
    prefix_re = re.compile(r'^(a|an|of|the|large|small|medium|fresh|dried|ground|chopped|minced|sliced|diced|peeled|shredded|grated|additional|extra-virgin|quality|plain|simple)\s+', re.IGNORECASE)
    for _ in range(3): # repeat to catch multiple prefixes like "A Large Fresh..."
        n = prefix_re.sub('', n).strip()
    
    # 6. Repetitive character filter (kills gibberish like "Aaaaaa")
    if re.search(r'(.)\1\1', n): return None
    
    # Final quality checks
    # Must be 3-40 chars, start with a letter, no digits, contain a vowel.
    if len(n) < 3 or len(n) > 35: return None
    if not n[0].isalpha(): return None
    if any(c.isdigit() for c in n): return None
    if not re.match(r'^[a-zA-Z\s\-]+$', n): return None
    if not any(v in n.lower() for v in 'aeiou'): return None
    
    # Final check: shouldn't look like a quantity or random word
    if n.lower() in ['about', 'and', 'with', 'optional', 'plus', 'approx', 'more']: return None
    
    return n.title()


# ─── Blocked terms (never show these on the site) ──────────────────────────
BLOCKED = ("beef", "steak", "burger", "brisket", "mince", "veal")

# Pre-built LIKE patterns for recipe name exclusion
_EXCL_PATTERNS = tuple(f"%{t}%" for t in BLOCKED)

def _name_excl_clause(alias=""):
    """Returns (WHERE fragment, params) excluding BLOCKED terms from a name column."""
    col = f"{alias}.name" if alias else "name"
    clause = " AND ".join(f"{col} NOT LIKE %s" for _ in BLOCKED)
    return clause, _EXCL_PATTERNS


# ─── Helper ────────────────────────────────────────────────────────────────

def cache_image_background(recipe_id: int, recipe_name: str):
    """Fetch Pexels image in background and cache in DB."""
    con = connectDb()
    if con is None:
        return
    try:
        cur = con.cursor()
        image_url = fetch_image_from_pexels(recipe_name)
        if image_url:
            cur.execute("UPDATE recipe SET image_url = %s WHERE id = %s", (image_url, recipe_id))
            con.commit()
    except Exception as e:
        print(f"Background image cache error: {e}")
    finally:
        try:
            cur.close()
            con.close()
        except Exception:
            pass


def row_to_meal(row):
    """Convert a (id, name, image_url) row to a dict, triggering bg image fetch if needed."""
    recipe_id, name, image_url = row
    if not image_url:
        t = threading.Thread(target=cache_image_background, args=(recipe_id, name), daemon=True)
        t.start()
    return {"id": recipe_id, "name": name, "image_url": image_url or ""}


# ─── /api/db-info (for About page) ────────────────────────────────────────

@tables_bp.route("/api/db-info")
def db_info():
    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    cur = None
    try:
        cur = con.cursor()
        cur.execute("SELECT COUNT(*) FROM recipe")
        recipes = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM ingredient")
        ingredients = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM recipe_ingredient")
        recipe_ingredients = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM users")
        users = cur.fetchone()[0]
        return jsonify({
            "recipes": recipes,
            "ingredients": ingredients,
            "recipe_ingredients": recipe_ingredients,
            "users": users
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        con.close()


# ─── /stats ────────────────────────────────────────────────────────────────

@tables_bp.route("/stats")
def stats():
    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    cur = None
    try:
        cur = con.cursor()
        cur.execute("SELECT COUNT(*) FROM recipe")
        total_meals = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM ingredient")
        total_ingredients = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM recipe WHERE image_url IS NOT NULL")
        total_images = cur.fetchone()[0]
        return jsonify({
            "totalMeals": total_meals,
            "totalIngredients": total_ingredients,
            "totalImages": total_images
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        con.close()


# ─── /recipe-of-the-day ───────────────────────────────────────────────────

@tables_bp.route("/recipe-of-the-day")
def recipe_of_the_day():
    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    cur = None
    try:
        cur = con.cursor()
        # Get total recipe count
        cur.execute("SELECT COUNT(*) FROM recipe")
        total = cur.fetchone()[0]
        if total == 0:
            return jsonify({"error": "No recipes"}), 404
        # Deterministic pick based on today's date
        seed = int(hashlib.md5(str(date.today()).encode()).hexdigest(), 16)
        offset = seed % total
        exclude = ("%beef%", "%steak%", "%burger%", "%brisket%", "%mince%", "%veal%")
        cur.execute(
            "SELECT id, name, image_url FROM recipe "
            "WHERE name NOT LIKE %s AND name NOT LIKE %s AND name NOT LIKE %s "
            "AND name NOT LIKE %s AND name NOT LIKE %s AND name NOT LIKE %s "
            "AND image_url IS NOT NULL AND image_url != '' "
            "LIMIT 1 OFFSET %s",
            exclude + (offset % max(total - 6, 1),)
        )
        row = cur.fetchone()
        if not row:
            cur.execute(
                "SELECT id, name, image_url FROM recipe WHERE image_url IS NOT NULL LIMIT 1"
            )
            row = cur.fetchone()
        if not row:
            return jsonify({"error": "No suitable recipe"}), 404
        meal = row_to_meal(row)
        # Get ingredient count & avg rating
        cur.execute("SELECT COUNT(*) FROM recipe_ingredient WHERE recipe_id=%s", (row[0],))
        ing_count = cur.fetchone()[0]
        cur.execute("SELECT AVG(stars), COUNT(*) FROM ratings WHERE recipe_id=%s", (row[0],))
        rrow = cur.fetchone()
        avg_stars = round(rrow[0], 1) if rrow[0] else 0
        review_count = rrow[1] or 0
        meal["ingredient_count"] = ing_count
        meal["avg_stars"] = avg_stars
        meal["review_count"] = review_count
        return jsonify(meal)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        con.close()


# ─── /latest-meals (with infinite scroll offset) ──────────────────────────

@tables_bp.route("/latest-meals")
def latest_meals():
    offset = request.args.get("offset", 0, type=int)
    limit = request.args.get("limit", 12, type=int)
    limit = min(limit, 30)  # cap
    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    cur = None
    try:
        cur = con.cursor()
        exclude = ("%beef%", "%steak%", "%burger%", "%brisket%", "%mince%", "%veal%")
        cur.execute(
            "SELECT id, name, image_url FROM recipe "
            "WHERE name NOT LIKE %s AND name NOT LIKE %s AND name NOT LIKE %s "
            "AND name NOT LIKE %s AND name NOT LIKE %s AND name NOT LIKE %s "
            "ORDER BY id DESC LIMIT %s OFFSET %s",
            exclude + (limit, offset)
        )
        meals = [row_to_meal(r) for r in cur.fetchall()]
        has_more = len(meals) == limit
        return jsonify({"meals": meals, "has_more": has_more, "offset": offset + len(meals)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        con.close()


# ─── /random-meals ─────────────────────────────────────────────────────────

@tables_bp.route("/random-meals")
def random_meals():
    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    cur = None
    try:
        cur = con.cursor()
        # Efficient random sampling using RAND() with LIMIT
        exclude = ("%beef%", "%steak%", "%burger%", "%brisket%", "%mince%", "%veal%")
        cur.execute(
            "SELECT id, name, image_url FROM recipe "
            "WHERE name NOT LIKE %s AND name NOT LIKE %s AND name NOT LIKE %s "
            "AND name NOT LIKE %s AND name NOT LIKE %s AND name NOT LIKE %s "
            "ORDER BY RAND() LIMIT 8",
            exclude
        )
        meals = [row_to_meal(r) for r in cur.fetchall()]
        return jsonify({"meals": meals})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        con.close()


# ─── /ingredients ──────────────────────────────────────────────────────────

@tables_bp.route("/ingredients")
def ingredients():
    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()
        excl_clause, excl_params = _name_excl_clause()
        # Fetch indexed slice (start from A, skip digits/symbols)
        cur.execute(
            f"""SELECT TRIM(name) FROM ingredient
                WHERE {excl_clause}
                  AND name >= 'A'
                  AND LENGTH(TRIM(name)) >= 4
                ORDER BY name
                LIMIT 10000""",
            excl_params
        )
        raw = [r[0] for r in cur.fetchall() if r[0]]

        # Heavy extraction & repair loop
        found = set()
        for r in raw:
            rep = _clean_ingredient(r)
            if rep and rep not in found:
                found.add(rep)

        names = sorted(list(found))
        return jsonify({"ingredients": names})
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); con.close()


# ─── /search ───────────────────────────────────────────────────────────────

@tables_bp.route("/search")
def search():
    q = request.args.get("q", "")
    offset = request.args.get("offset", 0, type=int)
    limit = request.args.get("limit", 12, type=int)
    limit = min(limit, 30)
    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    cur = None
    try:
        cur = con.cursor()
        exclude = ("%beef%", "%steak%", "%burger%", "%brisket%", "%mince%", "%veal%")
        cur.execute(
            "SELECT id, name, image_url FROM recipe "
            "WHERE name LIKE %s "
            "AND name NOT LIKE %s AND name NOT LIKE %s AND name NOT LIKE %s "
            "AND name NOT LIKE %s AND name NOT LIKE %s AND name NOT LIKE %s "
            "LIMIT %s OFFSET %s",
            (f"%{q}%",) + exclude + (limit, offset)
        )
        meals = [row_to_meal(r) for r in cur.fetchall()]
        has_more = len(meals) == limit
        return jsonify({"meals": meals, "has_more": has_more, "offset": offset + len(meals)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        con.close()


# ─── /meals-by-category ────────────────────────────────────────────────────

@tables_bp.route("/meals-by-category")
def meals_by_category():
    category = request.args.get("category", "")
    offset = request.args.get("offset", 0, type=int)
    limit = request.args.get("limit", 12, type=int)
    limit = min(limit, 30)
    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    cur = None
    try:
        cur = con.cursor()
        exclude = ("%beef%", "%steak%", "%burger%", "%brisket%", "%mince%", "%veal%")
        cur.execute(
            "SELECT id, name, image_url FROM recipe "
            "WHERE name LIKE %s "
            "AND name NOT LIKE %s AND name NOT LIKE %s AND name NOT LIKE %s "
            "AND name NOT LIKE %s AND name NOT LIKE %s AND name NOT LIKE %s "
            "LIMIT %s OFFSET %s",
            (f"%{category}%",) + exclude + (limit, offset)
        )
        meals = [row_to_meal(r) for r in cur.fetchall()]
        has_more = len(meals) == limit
        return jsonify({"meals": meals, "has_more": has_more, "offset": offset + len(meals)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        con.close()


# ─── /meals-by-ingredient ──────────────────────────────────────────────────

@tables_bp.route("/meals-by-ingredient")
def meals_by_ingredient():
    ingredient = request.args.get("ingredient", "")
    offset = request.args.get("offset", 0, type=int)
    limit = request.args.get("limit", 12, type=int)
    limit = min(limit, 30)
    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    cur = None
    try:
        cur = con.cursor()
        r_excl_clause, r_excl_params = _name_excl_clause("r")
        i_excl_clause, i_excl_params = _name_excl_clause("i")
        cur.execute(f"""
            SELECT DISTINCT r.id, r.name, r.image_url
            FROM recipe r
            JOIN recipe_ingredient ri ON r.id = ri.recipe_id
            JOIN ingredient i ON ri.ingredient_id = i.id
            WHERE i.name LIKE %s
            AND {r_excl_clause}
            AND {i_excl_clause}
            LIMIT %s OFFSET %s
        """, (f"%{ingredient}%",) + r_excl_params + i_excl_params + (limit, offset))
        meals = [row_to_meal(r) for r in cur.fetchall()]
        has_more = len(meals) == limit
        return jsonify({"meals": meals, "has_more": has_more, "offset": offset + len(meals)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if cur: cur.close()
        con.close()


# ─── /recipe/<id> ──────────────────────────────────────────────────────────

@tables_bp.route("/recipe/<int:recipe_id>")
def recipe_detail(recipe_id):
    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()

        # Get recipe info
        cur.execute("SELECT id, name, instructions, image_url FROM recipe WHERE id = %s", (recipe_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Recipe not found"}), 404

        rid, name, instructions, image_url = row

        # Trigger bg image fetch if missing
        if not image_url:
            t = threading.Thread(target=cache_image_background, args=(rid, name), daemon=True)
            t.start()

        # Split instructions into steps
        steps = [s.strip() for s in (instructions or "").split("|") if s.strip()]

        # Get ingredients
        cur.execute("""
            SELECT i.name, ri.quantity, ri.unit
            FROM recipe_ingredient ri
            JOIN ingredient i ON ri.ingredient_id = i.id
            WHERE ri.recipe_id = %s
        """, (recipe_id,))
        ingredients = [
            {"name": r[0], "quantity": r[1], "unit": r[2]}
            for r in cur.fetchall()
        ]

        return jsonify({
            "id": rid,
            "name": name,
            "image_url": image_url or "",
            "steps": steps if steps else ["No instructions available."],
            "ingredients": ingredients
        })
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); con.close()


# ─── /getRecipes (kept for backward compat) ────────────────────────────────

@tables_bp.route("/getRecipes")
def getRecipes():
    recipe_name = request.args.get("name", "")
    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()
        cur.execute("""
            SELECT r.id, r.name, r.instructions, r.image_url,
                GROUP_CONCAT(
                    CONCAT_WS(' ', i.name,
                        NULLIF(LOWER(ri.quantity),'nan'),
                        NULLIF(LOWER(ri.unit),'nan'),
                        NULLIF(LOWER(ri.size),'nan'),
                        NULLIF(LOWER(ri.notes),'nan')
                    ) SEPARATOR ', '
                ) AS ingredients
            FROM recipe r
            JOIN recipe_ingredient ri ON r.id = ri.recipe_id
            JOIN ingredient i ON ri.ingredient_id = i.id
            WHERE r.name LIKE %s AND r.name NOT LIKE '%beef%' AND r.name NOT LIKE '%steak%' AND r.name NOT LIKE '%burger%' AND r.name NOT LIKE '%brisket%' AND r.name NOT LIKE '%mince%' AND r.name NOT LIKE '%veal%'
            GROUP BY r.id, r.name, r.instructions, r.image_url
            LIMIT 100
        """, (f"%{recipe_name}%",))

        recipes = []
        for row in cur.fetchall():
            recipe_id, name, instructions, image_url, ingr = row
            if not image_url:
                t = threading.Thread(target=cache_image_background, args=(recipe_id, name), daemon=True)
                t.start()
            recipes.append({
                "id": recipe_id, "name": name,
                "instructions": instructions,
                "image_url": image_url or "",
                "ingredients": ingr or ""
            })
        return jsonify({"recipes": recipes})
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); con.close()


# ─── Helper: admin guard ────────────────────────────────────────────────────

def admin_guard():
    """Returns (payload, None) if admin, or (None, (error_msg, status_code)) if not."""
    from routes.auth import get_current_user
    payload, err = get_current_user()
    if err:
        return None, (err, 401)
    if not payload.get("is_admin"):
        return None, ("Admin access required", 403)
    return payload, None


# ─── POST /recipe/add ────────────────────────────────────────────────────────

@tables_bp.route("/recipe/add", methods=["POST"])
def add_recipe():
    _, guard_err = admin_guard()
    if guard_err:
        return jsonify({"error": guard_err[0]}), guard_err[1]

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    image_url = (data.get("image_url") or "").strip() or None
    instructions_list = data.get("instructions", [])
    ingredients = data.get("ingredients", [])

    if not name:
        return jsonify({"error": "Recipe name is required"}), 400

    instructions_str = " | ".join(s.strip() for s in instructions_list if s.strip())

    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()
        cur.execute(
            "INSERT INTO recipe (name, instructions, image_url) VALUES (%s, %s, %s)",
            (name, instructions_str, image_url)
        )
        recipe_id = cur.lastrowid

        for ing in ingredients:
            ing_name = (ing.get("name") or "").strip()
            if not ing_name:
                continue
            qty = (ing.get("quantity") or "").strip()
            unit = (ing.get("unit") or "").strip()

            cur.execute("SELECT id FROM ingredient WHERE name = %s", (ing_name,))
            row = cur.fetchone()
            if row:
                ing_id = row[0]
            else:
                cur.execute("INSERT INTO ingredient (name) VALUES (%s)", (ing_name,))
                ing_id = cur.lastrowid

            cur.execute(
                "INSERT INTO recipe_ingredient (recipe_id, ingredient_id, quantity, unit) VALUES (%s, %s, %s, %s)",
                (recipe_id, ing_id, qty, unit)
            )

        con.commit()
        return jsonify({"message": "Recipe added!", "id": recipe_id}), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); con.close()


# ─── PUT /recipe/<id>/edit ───────────────────────────────────────────────────

@tables_bp.route("/recipe/<int:recipe_id>/edit", methods=["PUT"])
def edit_recipe(recipe_id):
    _, guard_err = admin_guard()
    if guard_err:
        return jsonify({"error": guard_err[0]}), guard_err[1]

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    image_url = (data.get("image_url") or "").strip() or None
    instructions_list = data.get("instructions", [])
    ingredients = data.get("ingredients", [])

    if not name:
        return jsonify({"error": "Recipe name is required"}), 400

    instructions_str = " | ".join(s.strip() for s in instructions_list if s.strip())

    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()
        # Check recipe exists first
        cur.execute("SELECT id FROM recipe WHERE id=%s", (recipe_id,))
        if not cur.fetchone():
            return jsonify({"error": "Recipe not found"}), 404

        cur.execute(
            "UPDATE recipe SET name=%s, instructions=%s, image_url=%s WHERE id=%s",
            (name, instructions_str, image_url, recipe_id)
        )

        cur.execute("DELETE FROM recipe_ingredient WHERE recipe_id=%s", (recipe_id,))

        for ing in ingredients:
            ing_name = (ing.get("name") or "").strip()
            if not ing_name:
                continue
            qty = (ing.get("quantity") or "").strip()
            unit = (ing.get("unit") or "").strip()

            cur.execute("SELECT id FROM ingredient WHERE name=%s", (ing_name,))
            row = cur.fetchone()
            if row:
                ing_id = row[0]
            else:
                cur.execute("INSERT INTO ingredient (name) VALUES (%s)", (ing_name,))
                ing_id = cur.lastrowid

            cur.execute(
                "INSERT INTO recipe_ingredient (recipe_id, ingredient_id, quantity, unit) VALUES (%s, %s, %s, %s)",
                (recipe_id, ing_id, qty, unit)
            )

        con.commit()
        return jsonify({"message": "Recipe updated!"}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); con.close()


# ─── DELETE /recipe/<id>/delete ─────────────────────────────────────────────

@tables_bp.route("/recipe/<int:recipe_id>/delete", methods=["DELETE"])
def delete_recipe(recipe_id):
    _, guard_err = admin_guard()
    if guard_err:
        return jsonify({"error": guard_err[0]}), guard_err[1]

    con = connectDb()
    if not con:
        return jsonify({"error": "DB error"}), 500
    try:
        cur = con.cursor()
        # Check existence first
        cur.execute("SELECT id FROM recipe WHERE id=%s", (recipe_id,))
        if not cur.fetchone():
            return jsonify({"error": "Recipe not found"}), 404
        cur.execute("DELETE FROM recipe_ingredient WHERE recipe_id=%s", (recipe_id,))
        cur.execute("DELETE FROM recipe WHERE id=%s", (recipe_id,))
        con.commit()
        return jsonify({"message": "Recipe deleted!"}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); con.close()
