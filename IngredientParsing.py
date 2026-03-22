import pandas as pd
import re
from tqdm import tqdm
import os

df = pd.read_pickle("Rearranged.pkl")

INGREDIENT_RE = re.compile(
    r"""
    ^\s*
    (?P<quantity>\d+(?:\s\d+\/\d+|\.\d+|\/\d+)?)?   
    \s*
    (?P<size>large|small|medium)?                  
    \s*
    (?P<unit>
        c\.?|cup|cups|
        tbsp\.?|tablespoons?|
        tsp\.?|teaspoons?|
        lb\.?|lbs?|
        oz\.?|
        pkg\.?|package|packages?
    )?
    \s*
    (?P<ingredient>[a-zA-Z][a-zA-Z\s\-]+?)          
    (?:\s*\((?P<notes>[^)]+)\))?         
    \s*$
    """,
    re.VERBOSE | re.IGNORECASE
)

def parse_ingredient(text: str) -> dict:
    text = text.strip()
    m = INGREDIENT_RE.match(text)
    if not m:
        return {
            "quantity": None,
            "unit": None,
            "size": None,
            "ingredient": text,
            "notes": None,
        }
    return {
        "quantity": m.group("quantity"),
        "unit": m.group("unit"),
        "size": m.group("size"),
        "ingredient": m.group("ingredient").strip(),
        "notes": m.group("notes"),
    }

recipes_df = df[["name", "directions"]].copy()
print("hello")
recipes_df.to_csv("NameNDirrections.csv", index=False)

output_file = "Ingredients.csv";
chunk_size = 10_000
total_rows = len(df)

for start in tqdm(range(0, total_rows, chunk_size), desc="Processing recipes"):
    chunk = df.iloc[start:start + chunk_size]

    rows = []

    for recipe_id, row in chunk.iterrows():
        if pd.isna(row["ingredients"]):
            continue

        for ing in re.split(r"\s*\|\s*", row["ingredients"]):
            parsed = parse_ingredient(ing)
            parsed["recipe_id"] = recipe_id
            parsed["recipe_name"] = row["name"]
            rows.append(parsed)

    if not rows:
        continue

    ingredients_df = pd.DataFrame(rows)

    # Write header only once
    ingredients_df.to_csv(
        output_file,
        mode="a",
        index=False,
        header=not os.path.exists(output_file)
    )

    del ingredients_df, rows  # free memory

print(f"Saved parsed ingredients to {output_file}")
print("hello")

