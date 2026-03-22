import requests
from db.connect import connectDb

PEXELS_API_KEY = "7b0dNQ4fzEK9T8QltUCtORcBlLRJFErt3aQGwWJjlebqA9Ujw8pbID1b"
PEXELS_URL = "https://api.pexels.com/v1/search"


def fetch_image_from_pexels(query: str) -> str | None:
    """Call Pexels API and return the best image URL, or None on failure."""
    try:
        resp = requests.get(
            PEXELS_URL,
            headers={"Authorization": PEXELS_API_KEY},
            params={"query": f"{query} food recipe", "per_page": 1, "orientation": "landscape"},
            timeout=5,
        )
        resp.raise_for_status()
        photos = resp.json().get("photos", [])
        if photos:
            return photos[0]["src"]["large"]
        return None
    except Exception as e:
        print(f"Pexels error for '{query}':", e)
        return None


def get_or_cache_image(recipe_id: int, recipe_name: str) -> str | None:
    """Return cached image_url from DB, or fetch from Pexels + cache it."""
    con = connectDb()
    if con is None:
        return None

    try:
        cur = con.cursor()

        # 1. Check cache first
        cur.execute("SELECT image_url FROM recipe WHERE id = %s", (recipe_id,))
        row = cur.fetchone()
        if row and row[0]:
            return row[0]

        # 2. Fetch from Pexels
        image_url = fetch_image_from_pexels(recipe_name)
        if not image_url:
            return None

        # 3. Cache in DB
        cur.execute("UPDATE recipe SET image_url = %s WHERE id = %s", (image_url, recipe_id))
        con.commit()

        return image_url

    except Exception as e:
        print("Image cache error:", e)
        return None
    finally:
        cur.close()
        con.close()
