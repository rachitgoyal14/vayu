import pandas as pd
import numpy as np

df = pd.read_csv(r"D:\VAYU\vayu\data\raw\aqi_india_38cols_knn_final.csv")

def introduce_anomalies(df, random_state=42):
    np.random.seed(random_state)

    # 1. Add NaN values (5%)
    for col in df.columns:
        df.loc[df.sample(frac=0.005).index, col] = np.nan

    # 2. Add duplicate rows (10%)
    duplicates = df.sample(frac=0.005)
    df = pd.concat([df, duplicates], ignore_index=True)

    # 3. Add invalid AQI values
    if 'AQI' in df.columns:
        df.loc[df.sample(frac=0.005).index, 'AQI'] = -50

    return df


# Now df becomes dirty
df = introduce_anomalies(df)

# 🔥 THIS LINE IS IMPORTANT
df.to_csv(r"D:\VAYU\vayu\data\raw\aqi_india_38cols_knn_final.csv", index=False)

print("Dataset is now messy ✅")