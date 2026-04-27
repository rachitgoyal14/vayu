import pandas as pd

try:
    old = pd.read_csv("/tmp/hourlyData_old.csv")
    print(f"Loaded {len(old)} existing rows")
except Exception:
    old = pd.DataFrame()
    print("No existing rows found")

new = pd.read_csv("/tmp/hourlyData_new.csv")
df = pd.concat([old, new]).drop_duplicates(subset=["city", "datetime"])
df = df.sort_values(["city", "datetime"]).reset_index(drop=True)
df.to_csv("pipelines/hourlyData.csv", index=False)
print(f"Total rows after merge: {len(df)}")