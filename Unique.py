import pandas as pd

df = pd.read_csv("Ingredients.csv")
n = len(df["unit"])

print(df.columns)
print(n)
print(df.head())
print(len(df))
unit_map = {
    # cups
    "c": "c.",
    "c.": "c.",
    "cup": "c.",
    "cups": "c.",

    # teaspoons
    "tsp": "tsp.",
    "tsp.": "tsp.",
    "teaspoon": "tsp.",
    "teaspoons": "tsp.",

    # tablespoons
    "tbsp": "tbsp.",
    "tbsp.": "tbsp.",
    "tablespoon": "tbsp.",
    "tablespoons": "tbsp.",

    # ounces
    "oz": "oz.",
    "oz.": "oz.",

    # pounds
    "lb": "lb.",
    "lb.": "lb.",
    "lbs": "lb.",
    "lbs.": "lb.",

    # packages
    "pkg": "pkg.",
    "pkg.": "pkg.",
    "package": "pkg.",
    "packages": "pkg.",
}
df["size"] = df["size"].str.lower().str.strip()
df["unit"] = df["unit"].str.lower().str.strip()
size_map = {
    "small": "small",
    "sm": "small",

    "medium": "medium",
    "med": "medium",

    "large": "large",
    "lg": "large",
}

df["size"] = df["size"].map(size_map).fillna(df["size"])
df["unit_normalized"] = df["unit"].map(unit_map).fillna(df["unit"])
df["recipe_id"] = df["recipe_id"] + 1
df.to_csv("Ingredients_cleaned.csv", index=False)

print(df["unit_normalized"].unique())
print(len(df["unit_normalized"]))
print(df["size"].unique())
print(df["quantity"].unique())
print(df["ingredient"].unique())
print("notes")
print(df["notes"].unique())