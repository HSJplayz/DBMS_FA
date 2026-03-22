import pandas as pd
from tqdm import tqdm

print("hello")
df = pd.read_pickle("DBCopy.pkl")

tqdm.pandas()

def parse_recipe(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    name = lines[0]

    ingredients = []
    directions = []
    section = None

    for line in lines[1:]:
        lower = line.lower()

        if lower.startswith("ingredients"):
            section = "ingredients"
            continue
        if lower.startswith("directions"):
            section = "directions"
            continue

        if line.startswith("-"):
            if section == "ingredients":
                ingredients.append(line[1:].strip())
            elif section == "directions":
                directions.append(line[1:].strip())

    return name, " | ".join(ingredients), " | ".join(directions)


new_df = pd.DataFrame(
    df["input"].progress_map(parse_recipe).tolist(),
    columns=["name", "ingredients", "directions"]
)

print(new_df.head())
print(new_df["ingredients"][4])
print(new_df.columns)
print(len(new_df))
new_df.to_pickle("Rearranged.pkl")