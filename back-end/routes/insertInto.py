from flask import jsonify,Blueprint
from db.connect import connectDb
from mysql.connector import Error
from routes.tableBluePrint import tables_bp
from tqdm import tqdm 
import pandas as pd
@tables_bp.route("/insertInto")
def insertInto():
    con = connectDb()
    # df = pd.read_csv("D:/github/Recipe-Finder/recipes_cleaned.csv")
    df = pd.read_csv("D:/github/Recipe-Finder/ingredients_cleaned.csv")

    if con is None:
        return {}
    try:
        cursor = con.cursor()
        n = len(df)
        for i in tqdm(range(n),desc="inserting rows"):
            id = i+1
            recipe_id = int(df["recipe_id"][i])
            quantity = str(df["quantity"][i])
            ingredient_name = str(df["ingredient"][i])
            unit = str(df["unit"][i])
            size = str(df["size"][i])
            notes = str(df["notes"][i])
            cursor.execute("SELECT id FROM ingredient WHERE name=%s", (ingredient_name,))
            result = cursor.fetchone()

            if result is None:
                continue
            ingredient_id = result[0]
            cursor.execute(
                "SELECT 1 FROM recipe_ingredient WHERE recipe_id=%s AND ingredient_id=%s",
                (recipe_id, ingredient_id)
            )
            if cursor.fetchone() is None:
                cursor.execute(
                "INSERT INTO recipe_ingredient (recipe_id, ingredient_id, quantity, unit, size, notes) "
                "VALUES (%s,%s,%s,%s,%s,%s)",
                (recipe_id, ingredient_id, quantity, unit, size, notes)
            )
            

        con.commit()
        print("cursor.execute()")
        return jsonify({"value":"inserted"})
    except Error as e:
        print("Error while getting tables ",e)
        return {}
    finally:
        if cursor:
            cursor.close()
        if con:
            con.close()

