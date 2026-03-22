import pandas as pd

df = pd.read_csv("Ingredients_cleaned.csv")
print(df.columns)
print(df.dtypes)
print(df.head())
print(df["unit"].unique())
# df["ingredient"] = df["ingredient"].fillna("UNKNOWN").str.strip()
# unique_ingredients = df["ingredient"].drop_duplicates().reset_index(drop=True)
# ingredients_df = pd.DataFrame({
#     "id": range(1, len(unique_ingredients) + 1),
#     "ingredient": unique_ingredients
# })
# ingredients_df.to_csv("unique_ingredients.csv", index=False)
# print(ingredients_df.head())