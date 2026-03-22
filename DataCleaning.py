import pandas as pd

df = pd.read_pickle("IngredientParsed.pkl")

print(len(df))
print(df.tail())