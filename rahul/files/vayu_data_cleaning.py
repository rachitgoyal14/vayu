"""
============================================================
 VAYU: Predictive Modeling & Unsupervised Clustering of
       Ambient Air Quality Across Indian Urban Centres
       Using CPCB Sensor Data
============================================================
 STEP 1 - EDA + DATA CLEANING PIPELINE
============================================================
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
import warnings
warnings.filterwarnings("ignore")

# ── Plot style ────────────────────────────────────────────
sns.set_theme(style="whitegrid", palette="muted")
plt.rcParams["figure.dpi"] = 120

# ═══════════════════════════════════════════════════════════
# 1. LOAD DATA
# ═══════════════════════════════════════════════════════════
print("=" * 60)
print("  VAYU - Data Cleaning Pipeline")
print("=" * 60)

RAW_PATH = r"C:\Users\Rahul kumar goyal\OneDrive\Documents\SUL_Project\files\3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69.csv"   # ← update if needed
CLEAN_PATH = r"C:\Users\Rahul kumar goyal\OneDrive\Documents\SUL_Project\files\vayu_cleaned_data.csv"

df_raw = pd.read_csv(RAW_PATH)
df = df_raw.copy()

print(f"\n[1] Raw dataset loaded  →  {df.shape[0]:,} rows × {df.shape[1]} columns")
print(f"    Columns: {df.columns.tolist()}")


# ═══════════════════════════════════════════════════════════
# 2. INITIAL INSPECTION
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[2] Initial Inspection")
print("─" * 60)

print("\n── Data Types ──")
print(df.dtypes)

print("\n── First 5 Rows ──")
print(df.head())

print("\n── Statistical Summary ──")
print(df.describe())


# ═══════════════════════════════════════════════════════════
# 3. MISSING VALUE ANALYSIS
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[3] Missing Value Analysis")
print("─" * 60)

missing = df.isnull().sum()
missing_pct = (missing / len(df) * 100).round(2)
missing_df = pd.DataFrame({"Missing Count": missing, "Missing %": missing_pct})
missing_df = missing_df[missing_df["Missing Count"] > 0]

if missing_df.empty:
    print("  ✔ No missing values found in text/date columns.")
else:
    print(missing_df)

# Visualise missingness
fig, ax = plt.subplots(figsize=(8, 4))
missing_all = pd.DataFrame({
    "Missing %": (df.isnull().sum() / len(df) * 100)
})
missing_all.plot(kind="bar", ax=ax, color="steelblue", legend=False)
ax.set_title("Missing Values (%) per Column")
ax.set_ylabel("Missing %")
ax.set_xticklabels(ax.get_xticklabels(), rotation=45, ha="right")
plt.tight_layout()
plt.savefig(r"C:\Users\Rahul kumar goyal\OneDrive\Documents\SUL_Project\files\vayu_missing_values.png")
plt.close()
print("  → Saved: vayu_missing_values.png")


# ═══════════════════════════════════════════════════════════
# 4. PARSE DATETIME
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[4] Datetime Parsing")
print("─" * 60)

df["last_update"] = pd.to_datetime(df["last_update"], format="%d-%m-%Y %H:%M", errors="coerce")

invalid_dates = df["last_update"].isna().sum()
print(f"  Rows with un-parseable dates : {invalid_dates}")

# Drop rows where date could not be parsed
df = df.dropna(subset=["last_update"])

# Derive useful time features
df["year"]    = df["last_update"].dt.year
df["month"]   = df["last_update"].dt.month
df["day"]     = df["last_update"].dt.day
df["hour"]    = df["last_update"].dt.hour
df["weekday"] = df["last_update"].dt.day_name()

print(f"  Date range  :  {df['last_update'].min()}  →  {df['last_update'].max()}")
print(f"  New columns added : year, month, day, hour, weekday")


# ═══════════════════════════════════════════════════════════
# 5. HANDLE MISSING NUMERIC VALUES
#    Strategy:
#    – If a station has only 1-2 readings for a pollutant,
#      we cannot reliably impute → drop those rows.
#    – Otherwise impute with per-station, per-pollutant median.
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[5] Imputing Missing Numeric Values")
print("─" * 60)

NUMERIC_COLS = ["pollutant_min", "pollutant_max", "pollutant_avg"]

before = df[NUMERIC_COLS].isnull().sum().sum()
print(f"  Total missing values in numeric columns (before) : {before}")

# Impute with median per (station, pollutant_id) group
for col in NUMERIC_COLS:
    df[col] = df.groupby(["station", "pollutant_id"])[col].transform(
        lambda x: x.fillna(x.median())
    )

# Any still-missing rows → impute with global pollutant median
for col in NUMERIC_COLS:
    df[col] = df.groupby("pollutant_id")[col].transform(
        lambda x: x.fillna(x.median())
    )

after = df[NUMERIC_COLS].isnull().sum().sum()
print(f"  Total missing values in numeric columns (after)  : {after}")

if after > 0:
    df = df.dropna(subset=NUMERIC_COLS)
    print(f"  Remaining missing rows dropped. Rows left: {len(df):,}")


# ═══════════════════════════════════════════════════════════
# 6. REMOVE DUPLICATE ROWS
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[6] Removing Duplicate Rows")
print("─" * 60)

before = len(df)
df = df.drop_duplicates()
after  = len(df)
print(f"  Duplicates removed : {before - after}  (rows left: {after:,})")


# ═══════════════════════════════════════════════════════════
# 7. VALIDATE GEOGRAPHIC COORDINATES
#    India bounding box (approx): lat 6–37 °N, lon 68–98 °E
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[7] Geographic Coordinate Validation")
print("─" * 60)

before = len(df)
df = df[
    (df["latitude"]  >= 6)  & (df["latitude"]  <= 37) &
    (df["longitude"] >= 68) & (df["longitude"] <= 98)
]
after = len(df)
print(f"  Rows outside India bounding box removed : {before - after}")
print(f"  Lat range : {df['latitude'].min():.4f} – {df['latitude'].max():.4f}")
print(f"  Lon range : {df['longitude'].min():.4f} – {df['longitude'].max():.4f}")


# ═══════════════════════════════════════════════════════════
# 8. LOGICAL CONSISTENCY CHECKS
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[8] Logical Consistency Checks")
print("─" * 60)

# Rule 1: pollutant_min  ≤  pollutant_avg  ≤  pollutant_max
inconsistent_mask = (
    (df["pollutant_min"] > df["pollutant_avg"]) |
    (df["pollutant_avg"] > df["pollutant_max"])
)
print(f"  Rows violating min ≤ avg ≤ max : {inconsistent_mask.sum()}")
df = df[~inconsistent_mask]

# Rule 2: No non-positive readings (pollutant concentrations > 0)
neg_mask = (df[NUMERIC_COLS] <= 0).any(axis=1)
print(f"  Rows with zero / negative readings : {neg_mask.sum()}")
df = df[~neg_mask]

print(f"  Rows remaining after consistency checks : {len(df):,}")


# ═══════════════════════════════════════════════════════════
# 9. POLLUTANT-SPECIFIC RANGE VALIDATION
#    Safe WHO / CPCB upper-limit references (relaxed for Indian data)
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[9] Pollutant-Specific Range Validation")
print("─" * 60)

POLLUTANT_LIMITS = {
    "PM2.5" : {"min": 0, "max": 500},   # μg/m³  – NAAQS emergency level
    "PM10"  : {"min": 0, "max": 600},
    "NO2"   : {"min": 0, "max": 400},
    "SO2"   : {"min": 0, "max": 800},
    "CO"    : {"min": 0, "max": 50},     # mg/m³
    "OZONE" : {"min": 0, "max": 500},
    "NH3"   : {"min": 0, "max": 400},
}

removed_by_pollutant = {}
for pollutant, limits in POLLUTANT_LIMITS.items():
    mask = df["pollutant_id"] == pollutant
    out_of_range = mask & (
        (df["pollutant_avg"] < limits["min"]) |
        (df["pollutant_avg"] > limits["max"])
    )
    count = out_of_range.sum()
    removed_by_pollutant[pollutant] = count
    df = df[~out_of_range]

for p, c in removed_by_pollutant.items():
    print(f"  {p:8s} – out-of-range rows removed: {c}")

print(f"\n  Rows remaining after range validation : {len(df):,}")


# ═══════════════════════════════════════════════════════════
# 10. OUTLIER DETECTION & TREATMENT  (IQR Method)
#     Apply per-pollutant on pollutant_avg.
#     We CAP (winsorise) instead of dropping to preserve data.
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[10] Outlier Detection & Treatment (IQR Winsorisation)")
print("─" * 60)

outlier_counts = {}
for pollutant in df["pollutant_id"].unique():
    idx = df["pollutant_id"] == pollutant
    Q1  = df.loc[idx, "pollutant_avg"].quantile(0.25)
    Q3  = df.loc[idx, "pollutant_avg"].quantile(0.75)
    IQR = Q3 - Q1
    lower = Q1 - 1.5 * IQR
    upper = Q3 + 1.5 * IQR

    n_outliers = ((df.loc[idx, "pollutant_avg"] < lower) |
                  (df.loc[idx, "pollutant_avg"] > upper)).sum()
    outlier_counts[pollutant] = n_outliers

    # Winsorise (cap) outliers
    df.loc[idx, "pollutant_avg"] = df.loc[idx, "pollutant_avg"].clip(lower, upper)
    df.loc[idx, "pollutant_min"] = df.loc[idx, "pollutant_min"].clip(lower, upper)
    df.loc[idx, "pollutant_max"] = df.loc[idx, "pollutant_max"].clip(lower, upper)

for p, c in outlier_counts.items():
    print(f"  {p:8s} - outliers winsorised: {c}")


# ═══════════════════════════════════════════════════════════
# 11. STRING STANDARDISATION
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[11] String Standardisation")
print("─" * 60)

str_cols = ["country", "state", "city", "station", "pollutant_id"]

for col in str_cols:
    df[col] = (df[col]
               .str.strip()
               .str.replace("_", " ", regex=False)
               .str.title())

print(f"  Cleaned columns : {str_cols}")
print(f"  Unique states   : {df['state'].nunique()}")
print(f"  Unique cities   : {df['city'].nunique()}")
print(f"  Unique stations : {df['station'].nunique()}")
print(f"  Pollutants      : {sorted(df['pollutant_id'].unique())}")


# ═══════════════════════════════════════════════════════════
# 12. FEATURE ENGINEERING
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[12] Feature Engineering")
print("─" * 60)

# (a) Pollutant range spread
df["pollutant_range"] = df["pollutant_max"] - df["pollutant_min"]

# (b) AQI bucket (simplified CPCB scale based on PM2.5 / PM10 avg)
def aqi_category(row):
    v = row["pollutant_avg"]
    if row["pollutant_id"] in ["PM2.5", "PM10"]:
        if v <= 30:   return "Good"
        if v <= 60:   return "Satisfactory"
        if v <= 90:   return "Moderate"
        if v <= 120:  return "Poor"
        if v <= 250:  return "Very Poor"
        return "Severe"
    return "N/A"  # other pollutants need unit-specific conversion

df["aqi_category"] = df.apply(aqi_category, axis=1)

# (c) Season
def get_season(month):
    if month in [12, 1, 2]:   return "Winter"
    if month in [3, 4, 5]:    return "Summer"
    if month in [6, 7, 8, 9]: return "Monsoon"
    return "Post-Monsoon"

df["season"] = df["month"].apply(get_season)

print("  New columns : pollutant_range, aqi_category, season")


# ═══════════════════════════════════════════════════════════
# 13. EDA VISUALISATIONS
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[13] Generating EDA Plots")
print("─" * 60)

# ── A. Distribution of avg pollutant values per pollutant ─
g = sns.FacetGrid(df, col="pollutant_id", col_wrap=4, height=3, sharey=False)
g.map(sns.histplot, "pollutant_avg", bins=30, color="steelblue")
g.set_axis_labels("Avg Concentration", "Count")
g.set_titles("{col_name}")
g.figure.suptitle("Distribution of Avg Pollutant Concentration", y=1.02)
plt.tight_layout()
plt.savefig(r"C:\Users\Rahul kumar goyal\OneDrive\Documents\SUL_Project\files\vayu_eda_distributions.png")
plt.close()
print("  → Saved: vayu_eda_distributions.png")

# ── B. Correlation heatmap ────────────────────────────────
corr_df = df[["pollutant_min", "pollutant_max", "pollutant_avg",
              "pollutant_range", "latitude", "longitude"]].corr()
fig, ax = plt.subplots(figsize=(7, 5))
sns.heatmap(corr_df, annot=True, fmt=".2f", cmap="coolwarm", ax=ax)
ax.set_title("Correlation Heatmap")
plt.tight_layout()
plt.savefig(r"C:\Users\Rahul kumar goyal\OneDrive\Documents\SUL_Project\files\vayu_eda_correlation.png")
plt.close()
print("  → Saved: vayu_eda_correlation.png")

# ── C. Top 10 most polluted cities (by PM2.5 avg) ────────
pm25 = df[df["pollutant_id"] == "Pm2.5"] if "Pm2.5" in df["pollutant_id"].values \
       else df[df["pollutant_id"].str.upper() == "PM2.5"]
if not pm25.empty:
    top_cities = (pm25.groupby("city")["pollutant_avg"]
                      .mean()
                      .nlargest(10)
                      .reset_index())
    fig, ax = plt.subplots(figsize=(8, 4))
    sns.barplot(data=top_cities, x="pollutant_avg", y="city", ax=ax, palette="Reds_r")
    ax.set_title("Top 10 Most Polluted Cities - PM2.5 Avg")
    ax.set_xlabel("Average PM2.5 (μg/m³)")
    plt.tight_layout()
    plt.savefig(r"C:\Users\Rahul kumar goyal\OneDrive\Documents\SUL_Project\files\vayu_eda_top_pm25_cities.png")
    plt.close()
    print("  → Saved: vayu_eda_top_pm25_cities.png")

# ── D. Boxplot per pollutant ─────────────────────────────
fig, ax = plt.subplots(figsize=(10, 5))
sns.boxplot(data=df, x="pollutant_id", y="pollutant_avg", palette="Set2", ax=ax)
ax.set_title("Pollutant Avg Concentration - Boxplot")
ax.set_xlabel("Pollutant")
ax.set_ylabel("Avg Concentration")
plt.tight_layout()
plt.savefig(r"C:\Users\Rahul kumar goyal\OneDrive\Documents\SUL_Project\files\vayu_eda_boxplot.png")
plt.close()
print("  → Saved: vayu_eda_boxplot.png")

# ── E. AQI Category Distribution (PM2.5 + PM10 only) ─────
aqi_df = df[df["aqi_category"] != "N/A"]
if not aqi_df.empty:
    order = ["Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"]
    fig, ax = plt.subplots(figsize=(8, 4))
    sns.countplot(data=aqi_df, x="aqi_category", order=order,
                  palette=["green","yellowgreen","yellow","orange","red","maroon"], ax=ax)
    ax.set_title("AQI Category Distribution (PM2.5 + PM10)")
    ax.set_xlabel("AQI Category")
    ax.set_ylabel("Count")
    plt.tight_layout()
    plt.savefig(r"C:\Users\Rahul kumar goyal\OneDrive\Documents\SUL_Project\files\vayu_eda_aqi_categories.png")
    plt.close()
    print("  → Saved: vayu_eda_aqi_categories.png")


# ═══════════════════════════════════════════════════════════
# 14. FINAL SUMMARY
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[14] Cleaning Summary")
print("─" * 60)

print(f"  Raw rows              : {df_raw.shape[0]:,}")
print(f"  Clean rows            : {df.shape[0]:,}")
print(f"  Rows removed          : {df_raw.shape[0] - df.shape[0]:,}")
print(f"  Final columns         : {df.shape[1]}")
print(f"  Remaining null values : {df.isnull().sum().sum()}")
print(f"\n  Column list:")
for c in df.columns:
    print(f"    • {c}  ({df[c].dtype})")


# ═══════════════════════════════════════════════════════════
# 15. SAVE CLEANED DATA
# ═══════════════════════════════════════════════════════════
df.to_csv(CLEAN_PATH, index=False)
print(f"\n[15] Cleaned data saved → '{CLEAN_PATH}'")
print("\n  ✅ Pipeline complete - ready for ML / clustering!\n")


# ╔═══════════════════════════════════════════════════════════╗
# ║           PHASE 2 - MODEL TRAINING                       ║
# ║   Topics: Linear Regression, Multiple Linear Regression, ║
# ║   Polynomial Regression, Logistic Regression,            ║
# ║   Gradient Descent, Evaluation Metrics                   ║
# ╚═══════════════════════════════════════════════════════════╝

from sklearn.linear_model import LinearRegression, LogisticRegression, SGDRegressor
from sklearn.preprocessing  import PolynomialFeatures, StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import (mean_squared_error, r2_score,
                             confusion_matrix, classification_report,
                             ConfusionMatrixDisplay,
                             precision_score, recall_score, f1_score)
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import warnings
warnings.filterwarnings("ignore")

OUTPUT_DIR = r"C:\Users\Rahul kumar goyal\OneDrive\Documents\SUL_Project\files"

print("\n" + "═" * 60)
print("  PHASE 2 - MODEL TRAINING")
print("═" * 60)


# ───────────────────────────────────────────────────────────
# FIX: Re-apply AQI category (pollutant_id is now Title Case)
# ───────────────────────────────────────────────────────────
def aqi_category_fixed(row):
    v  = row["pollutant_avg"]
    pid = row["pollutant_id"].upper()
    if pid in ["PM2.5", "PM10"]:
        if v <= 30:  return "Good"
        if v <= 60:  return "Satisfactory"
        if v <= 90:  return "Moderate"
        if v <= 120: return "Poor"
        if v <= 250: return "Very Poor"
        return "Severe"
    return "N/A"

df["aqi_category"] = df.apply(aqi_category_fixed, axis=1)


# ───────────────────────────────────────────────────────────
# ENCODE CATEGORICAL FEATURES
# One-hot encode pollutant_id and season for ML models
# ───────────────────────────────────────────────────────────
df_model = df.copy()
df_model = pd.get_dummies(df_model, columns=["pollutant_id", "season"], drop_first=True)

FEATURE_COLS = (["latitude", "longitude", "month", "pollutant_min", "pollutant_max"]
                + [c for c in df_model.columns if c.startswith("pollutant_id_")
                                                or c.startswith("season_")])
TARGET_REG  = "pollutant_avg"       # Regression target
TARGET_CLF  = "aqi_category"        # Classification target (PM2.5 + PM10 only)


# ═══════════════════════════════════════════════════════════
# A. SIMPLE LINEAR REGRESSION
#    Predict pollutant_avg using pollutant_min only
#    (one feature → easy to visualise the "best line")
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[A] Simple Linear Regression  (pollutant_min → pollutant_avg)")
print("─" * 60)

X_simple = df[["pollutant_min"]]
y_simple  = df["pollutant_avg"]

X_tr, X_te, y_tr, y_te = train_test_split(X_simple, y_simple,
                                           test_size=0.2, random_state=42)

slr = LinearRegression()
slr.fit(X_tr, y_tr)
y_pred_slr = slr.predict(X_te)

mse_slr  = mean_squared_error(y_te, y_pred_slr)
rmse_slr = np.sqrt(mse_slr)
r2_slr   = r2_score(y_te, y_pred_slr)

print(f"  Coefficient (slope)  : {slr.coef_[0]:.4f}")
print(f"  Intercept            : {slr.intercept_:.4f}")
print(f"  MSE                  : {mse_slr:.4f}")
print(f"  RMSE                 : {rmse_slr:.4f}")
print(f"  R² Score             : {r2_slr:.4f}")

# Plot: Best Fit Line
fig, ax = plt.subplots(figsize=(8, 5))
ax.scatter(X_te, y_te, alpha=0.4, color="steelblue", label="Actual", s=20)
x_line = np.linspace(X_te.min().values[0], X_te.max().values[0], 200).reshape(-1, 1)
ax.plot(x_line, slr.predict(x_line), color="red", linewidth=2, label="Best Fit Line")
ax.set_xlabel("Pollutant Min")
ax.set_ylabel("Pollutant Avg")
ax.set_title("Simple Linear Regression - Best Fit Line")
ax.legend()
plt.tight_layout()
plt.savefig(OUTPUT_DIR + r"\vayu_slr_bestfit.png")
plt.close()
print("  → Saved: vayu_slr_bestfit.png")


# ═══════════════════════════════════════════════════════════
# B. MULTIPLE LINEAR REGRESSION
#    Predict pollutant_avg using multiple features
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[B] Multiple Linear Regression  (multiple features → pollutant_avg)")
print("─" * 60)

X_multi = df_model[FEATURE_COLS]
y_multi  = df_model[TARGET_REG]

X_tr, X_te, y_tr, y_te = train_test_split(X_multi, y_multi,
                                           test_size=0.2, random_state=42)

mlr = LinearRegression()
mlr.fit(X_tr, y_tr)
y_pred_mlr = mlr.predict(X_te)

mse_mlr  = mean_squared_error(y_te, y_pred_mlr)
rmse_mlr = np.sqrt(mse_mlr)
r2_mlr   = r2_score(y_te, y_pred_mlr)

print(f"  MSE    : {mse_mlr:.4f}")
print(f"  RMSE   : {rmse_mlr:.4f}")
print(f"  R²     : {r2_mlr:.4f}")

# Plot: Actual vs Predicted
fig, ax = plt.subplots(figsize=(7, 5))
ax.scatter(y_te, y_pred_mlr, alpha=0.4, color="teal", s=20)
ax.plot([y_te.min(), y_te.max()], [y_te.min(), y_te.max()],
        "r--", linewidth=2, label="Perfect Prediction")
ax.set_xlabel("Actual Pollutant Avg")
ax.set_ylabel("Predicted Pollutant Avg")
ax.set_title("Multiple Linear Regression - Actual vs Predicted")
ax.legend()
plt.tight_layout()
plt.savefig(OUTPUT_DIR + r"\vayu_mlr_actual_vs_pred.png")
plt.close()
print("  → Saved: vayu_mlr_actual_vs_pred.png")

# Feature importance (coefficients)
coef_df = pd.DataFrame({
    "Feature"    : FEATURE_COLS,
    "Coefficient": mlr.coef_
}).sort_values("Coefficient", key=abs, ascending=False).head(10)

fig, ax = plt.subplots(figsize=(8, 5))
sns.barplot(data=coef_df, x="Coefficient", y="Feature", palette="coolwarm", ax=ax)
ax.set_title("Top 10 Feature Coefficients - Multiple Linear Regression")
plt.tight_layout()
plt.savefig(OUTPUT_DIR + r"\vayu_mlr_coefficients.png")
plt.close()
print("  → Saved: vayu_mlr_coefficients.png")


# ═══════════════════════════════════════════════════════════
# C. POLYNOMIAL REGRESSION  (degree = 2)
#    Shows non-linear relationship between min and avg
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[C] Polynomial Regression  (degree=2, pollutant_min → pollutant_avg)")
print("─" * 60)

X_poly_raw = df[["pollutant_min"]]
y_poly     = df["pollutant_avg"]

poly = PolynomialFeatures(degree=2, include_bias=False)
X_poly = poly.fit_transform(X_poly_raw)

X_tr, X_te, y_tr, y_te = train_test_split(X_poly, y_poly,
                                           test_size=0.2, random_state=42)

plr = LinearRegression()
plr.fit(X_tr, y_tr)
y_pred_plr = plr.predict(X_te)

mse_plr  = mean_squared_error(y_te, y_pred_plr)
rmse_plr = np.sqrt(mse_plr)
r2_plr   = r2_score(y_te, y_pred_plr)

print(f"  MSE    : {mse_plr:.4f}")
print(f"  RMSE   : {rmse_plr:.4f}")
print(f"  R²     : {r2_plr:.4f}")

# Plot: Polynomial curve
x_vis  = np.linspace(df["pollutant_min"].min(), df["pollutant_min"].max(), 300).reshape(-1,1)
x_vis_poly = poly.transform(x_vis)

fig, ax = plt.subplots(figsize=(8, 5))
ax.scatter(df["pollutant_min"], df["pollutant_avg"],
           alpha=0.2, color="steelblue", s=15, label="Data")
ax.plot(x_vis, plr.predict(x_vis_poly), color="red", linewidth=2, label="Poly Curve (deg=2)")
ax.set_xlabel("Pollutant Min")
ax.set_ylabel("Pollutant Avg")
ax.set_title("Polynomial Regression (degree=2)")
ax.legend()
plt.tight_layout()
plt.savefig(OUTPUT_DIR + r"\vayu_poly_regression.png")
plt.close()
print("  → Saved: vayu_poly_regression.png")


# ═══════════════════════════════════════════════════════════
# D. GRADIENT DESCENT  (SGD Regressor)
#    Manual demonstration of how loss reduces over iterations
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[D] Gradient Descent  (SGDRegressor - loss vs iterations)")
print("─" * 60)

scaler = StandardScaler()
X_gd = scaler.fit_transform(df_model[FEATURE_COLS])
y_gd = df_model[TARGET_REG].values

X_tr, X_te, y_tr, y_te = train_test_split(X_gd, y_gd,
                                           test_size=0.2, random_state=42)

# Track loss across epochs manually
losses = []
sgd = SGDRegressor(max_iter=1, warm_start=True, random_state=42,
                   learning_rate="constant", eta0=0.01, tol=None)

for epoch in range(1, 101):
    sgd.fit(X_tr, y_tr)
    y_pred_epoch = sgd.predict(X_te)
    losses.append(mean_squared_error(y_te, y_pred_epoch))

print(f"  Initial loss (epoch 1)  : {losses[0]:.4f}")
print(f"  Final loss  (epoch 100) : {losses[-1]:.4f}")
print(f"  Loss reduced by         : {losses[0] - losses[-1]:.4f}")

# Plot: Loss curve
fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(range(1, 101), losses, color="crimson", linewidth=2)
ax.set_xlabel("Epoch (Iteration)")
ax.set_ylabel("MSE Loss")
ax.set_title("Gradient Descent - Loss vs Iterations")
ax.fill_between(range(1, 101), losses, alpha=0.1, color="crimson")
plt.tight_layout()
plt.savefig(OUTPUT_DIR + r"\vayu_gradient_descent_loss.png")
plt.close()
print("  → Saved: vayu_gradient_descent_loss.png")


# ═══════════════════════════════════════════════════════════
# E. LOGISTIC REGRESSION  (Classification)
#    Predict AQI Category for PM2.5 + PM10 rows
#    Classes: Good / Satisfactory / Moderate / Poor / Very Poor / Severe
# ═══════════════════════════════════════════════════════════
print("\n" + "─" * 60)
print("[E] Logistic Regression  (AQI Category Classification)")
print("─" * 60)

# Filter only PM2.5 and PM10 rows (have AQI category)
clf_df = df[df["aqi_category"] != "N/A"].copy()
clf_df = pd.get_dummies(clf_df, columns=["season"], drop_first=True)

CLF_FEATURES = (["latitude", "longitude", "month", "pollutant_min",
                  "pollutant_max", "pollutant_range"]
                + [c for c in clf_df.columns if c.startswith("season_")])

X_clf = clf_df[CLF_FEATURES]
y_clf = clf_df["aqi_category"]

# Encode labels
le = LabelEncoder()
y_clf_enc = le.fit_transform(y_clf)

X_tr, X_te, y_tr, y_te = train_test_split(X_clf, y_clf_enc,
                                           test_size=0.2, random_state=42,
                                           stratify=y_clf_enc)

# Scale features (important for Logistic Regression)
scaler_clf = StandardScaler()
X_tr_sc = scaler_clf.fit_transform(X_tr)
X_te_sc  = scaler_clf.transform(X_te)

log_reg = LogisticRegression(max_iter=1000, random_state=42,
                              solver="lbfgs")
log_reg.fit(X_tr_sc, y_tr)
y_pred_clf = log_reg.predict(X_te_sc)

# ── Evaluation Metrics ────────────────────────────────────
print("\n  Classification Report:")
print(classification_report(y_te, y_pred_clf,
                             target_names=le.classes_))

precision = precision_score(y_te, y_pred_clf, average="weighted")
recall    = recall_score(y_te, y_pred_clf, average="weighted")
f1        = f1_score(y_te, y_pred_clf, average="weighted")

print(f"  Weighted Precision : {precision:.4f}")
print(f"  Weighted Recall    : {recall:.4f}")
print(f"  Weighted F1-Score  : {f1:.4f}")

# Confusion Matrix
cm = confusion_matrix(y_te, y_pred_clf)
fig, ax = plt.subplots(figsize=(8, 6))
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=le.classes_)
disp.plot(ax=ax, cmap="Blues", colorbar=False)
ax.set_title("Logistic Regression - Confusion Matrix (AQI Category)")
plt.xticks(rotation=30, ha="right")
plt.tight_layout()
plt.savefig(OUTPUT_DIR + r"\vayu_logistic_confusion_matrix.png")
plt.close()
print("  → Saved: vayu_logistic_confusion_matrix.png")

# Sigmoid function illustration
print("\n  (Plotting sigmoid function for conceptual understanding...)")
z = np.linspace(-10, 10, 300)
sigmoid = 1 / (1 + np.exp(-z))
fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(z, sigmoid, color="darkorange", linewidth=2.5)
ax.axhline(0.5, color="gray", linestyle="--", linewidth=1)
ax.axvline(0,   color="gray", linestyle="--", linewidth=1)
ax.set_xlabel("z  (linear combination of features)")
ax.set_ylabel("σ(z)  =  1 / (1 + e⁻ᶻ)")
ax.set_title("Sigmoid Function - Used in Logistic Regression")
ax.fill_between(z, sigmoid, 0.5, where=(sigmoid > 0.5), alpha=0.15, color="green", label="Predict Class 1")
ax.fill_between(z, sigmoid, 0.5, where=(sigmoid < 0.5), alpha=0.15, color="red",   label="Predict Class 0")
ax.legend()
plt.tight_layout()
plt.savefig(OUTPUT_DIR + r"\vayu_sigmoid_function.png")
plt.close()
print("  → Saved: vayu_sigmoid_function.png")


# ═══════════════════════════════════════════════════════════
# F. MODEL COMPARISON SUMMARY
# ═══════════════════════════════════════════════════════════
print("\n" + "═" * 60)
print("  MODEL COMPARISON SUMMARY")
print("═" * 60)

print(f"""
  ┌─────────────────────────────┬────────┬────────┬────────┐
  │ Model                       │  MSE   │  RMSE  │   R²   │
  ├─────────────────────────────┼────────┼────────┼────────┤
  │ Simple Linear Regression    │{mse_slr:7.2f} │{rmse_slr:7.2f} │{r2_slr:7.4f}│
  │ Multiple Linear Regression  │{mse_mlr:7.2f} │{rmse_mlr:7.2f} │{r2_mlr:7.4f}│
  │ Polynomial Regression(deg2) │{mse_plr:7.2f} │{rmse_plr:7.2f} │{r2_plr:7.4f}│
  └─────────────────────────────┴────────┴────────┴────────┘

  Logistic Regression (Classification):
    Precision : {precision:.4f}
    Recall    : {recall:.4f}
    F1-Score  : {f1:.4f}
""")

print("  ✅ All models trained and evaluated successfully!")
print("  ✅ All plots saved to your files folder.")













# ═══════════════════════════════════════════════════════════
# G. PREDICT AQI FOR A NEW PLACE
#    Just change the values below and run the script!
# ═══════════════════════════════════════════════════════════
print("\n" + "═" * 60)
print("  PHASE 3 - AQI PREDICTION FOR NEW PLACE")
print("═" * 60)

# ──────────────────────────────────────────────────────────
# ✏️  CHANGE THESE VALUES FOR YOUR PLACE
# ──────────────────────────────────────────────────────────
PLACE_NAME    = "Delhi"          # Name of the place
LATITUDE      = 28.6139          # Latitude of the place
LONGITUDE     = 77.2090          # Longitude of the place
MONTH         = 3                # Month (1=Jan, 2=Feb ... 12=Dec)
PM25_MIN      = 45.0             # Expected PM2.5 minimum reading
PM25_MAX      = 180.0            # Expected PM2.5 maximum reading
PM10_MIN      = 60.0             # Expected PM10 minimum reading
PM10_MAX      = 220.0            # Expected PM10 maximum reading
# ──────────────────────────────────────────────────────────

def predict_aqi(place_name, lat, lon, month, p_min, p_max, pollutant_label):
    """Predict pollutant_avg and AQI category for given inputs."""

    p_range = p_max - p_min

    # -- Step 1: Predict pollutant_avg using Multiple Linear Regression --
    # Build a sample row matching the training feature columns
    sample = pd.DataFrame(columns=FEATURE_COLS)
    sample.loc[0] = 0  # fill all with 0 first

    sample["latitude"]      = lat
    sample["longitude"]     = lon
    sample["month"]         = month
    sample["pollutant_min"] = p_min
    sample["pollutant_max"] = p_max

    # Set the correct pollutant_id dummy column
    pid_col = f"pollutant_id_{pollutant_label}"
    if pid_col in sample.columns:
        sample[pid_col] = 1

    # Set season dummy based on month
    season_map = {
        12: "Winter", 1: "Winter", 2: "Winter",
        3:  "Summer", 4: "Summer", 5: "Summer",
        6:  "Monsoon", 7: "Monsoon", 8: "Monsoon", 9: "Monsoon",
        10: "Post-Monsoon", 11: "Post-Monsoon"
    }
    season = season_map[month]
    season_col = f"season_{season}"
    if season_col in sample.columns:
        sample[season_col] = 1

    sample = sample.astype(float)
    predicted_avg = mlr.predict(sample)[0]

    # -- Step 2: Predict AQI Category using Logistic Regression --
    clf_sample = pd.DataFrame({
        "latitude"        : [lat],
        "longitude"       : [lon],
        "month"           : [month],
        "pollutant_min"   : [p_min],
        "pollutant_max"   : [p_max],
        "pollutant_range" : [p_range],
    })

    # Add season dummies
    for col in [c for c in clf_df.columns if c.startswith("season_")]:
        clf_sample[col] = 0
    if season_col in clf_sample.columns:
        clf_sample[season_col] = 1

    # Align columns to training data
    for col in CLF_FEATURES:
        if col not in clf_sample.columns:
            clf_sample[col] = 0
    clf_sample = clf_sample[CLF_FEATURES].astype(float)

    clf_sample_scaled = scaler_clf.transform(clf_sample)
    predicted_cat_enc = log_reg.predict(clf_sample_scaled)[0]
    predicted_cat     = le.inverse_transform([predicted_cat_enc])[0]

    # Probabilities for each class
    probs = log_reg.predict_proba(clf_sample_scaled)[0]
    prob_df = pd.DataFrame({
        "AQI Category" : le.classes_,
        "Probability %": (probs * 100).round(2)
    }).sort_values("Probability %", ascending=False)

    return predicted_avg, predicted_cat, prob_df


# ── Run predictions for PM2.5 and PM10 ───────────────────
print(f"\n  📍 Location : {PLACE_NAME}")
print(f"  🌐 Lat/Lon  : {LATITUDE}, {LONGITUDE}")
print(f"  📅 Month    : {MONTH}")

for label, p_min, p_max in [("Pm2.5", PM25_MIN, PM25_MAX),
                              ("Pm10",  PM10_MIN, PM10_MAX)]:
    avg, cat, prob_df = predict_aqi(
        PLACE_NAME, LATITUDE, LONGITUDE, MONTH, p_min, p_max, label
    )

    print(f"\n  ── {label.upper()} ──")
    print(f"  Predicted Avg Concentration : {avg:.2f} µg/m³")
    print(f"  Predicted AQI Category      : {cat}")
    print(f"\n  Class Probabilities:")
    print(prob_df.to_string(index=False))

# ── AQI Probability Bar Chart ─────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(12, 5))
colors = {"Good":"green", "Satisfactory":"yellowgreen",
          "Moderate":"yellow", "Poor":"orange", "Very Poor":"red", "Severe":"maroon"}

for ax, (label, p_min, p_max) in zip(axes, [("Pm2.5", PM25_MIN, PM25_MAX),
                                              ("Pm10",  PM10_MIN, PM10_MAX)]):
    _, _, prob_df = predict_aqi(
        PLACE_NAME, LATITUDE, LONGITUDE, MONTH, p_min, p_max, label
    )
    bar_colors = [colors.get(c, "gray") for c in prob_df["AQI Category"]]
    ax.barh(prob_df["AQI Category"], prob_df["Probability %"], color=bar_colors)
    ax.set_xlabel("Probability %")
    ax.set_title(f"{PLACE_NAME} - {label.upper()} AQI Prediction")
    ax.set_xlim(0, 100)
    for i, v in enumerate(prob_df["Probability %"]):
        ax.text(v + 1, i, f"{v}%", va="center", fontsize=9)

plt.suptitle(f"AQI Category Probabilities - {PLACE_NAME}", fontsize=13)
plt.tight_layout()
plt.savefig(OUTPUT_DIR + r"\vayu_aqi_prediction.png")
plt.close()
print(f"\n  → Saved: vayu_aqi_prediction.png")
print(f"\n  ✅ Prediction complete for {PLACE_NAME}!")