from datasets import load_dataset
import json
import pandas as pd
import pickle
import re
dataset = load_dataset("corbt/all-recipes")

print(dataset["train"])

df = dataset["train"].to_pandas()
# # create a file callled this or something else
df.to_pickle("DBCopy.pkl")

# After downloading only below lines are required
df = pd.read_pickle("DBCopy.pkl")

print(type(df))
print(df.head())
print(df.columns.values)


ALLOWED_HEADERS = {
    "name",
    "ingredients",
    "directions",
}

def extract_headers(text):
    if not isinstance(text, str):
        return set()
    
    headers = re.findall(r"^\s*([A-Za-z ]+):",text,flags=re.MULTILINE)

    return {h.strip().lower() for h in headers}


def row_has_only_allowed_headers(text, allowed_headers):
    headers = extract_headers(text)

    if not headers:
        return False

    return headers.issubset(allowed_headers)


df_filtered = df[df["input"].apply(lambda x: row_has_only_allowed_headers(x, ALLOWED_HEADERS))].reset_index(drop=True)

df_filtered.to_pickle("DBCopy.pkl")
print(len(df_filtered))