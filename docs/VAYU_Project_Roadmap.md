# VAYU — Data Preparation Roadmap

**Project:** Predictive Modeling and Unsupervised Clustering of Ambient Air Quality Across Indian Urban Centres Using CPCB Sensor Data

---

## Overview

Your 299 raw files get cleaned and split into task-specific datasets across 5 folders. Each folder feeds a different set of ML models from your syllabus. The pipeline runs across 6 sequential `.ipynb` notebooks, each doing one clearly defined job.

```
data/
  raw/                        ← your original 299 files, untouched
  cleaned/
    05_shared/                ← master cleaned file (all steps read from here)
    01_regression/            ← Linear + Multiple Regression
    02_classification/        ← Logistic Regression, KNN, SVM, Trees, Random Forest
    03_clustering/            ← K-Means
    04_dimensionality/        ← PCA, t-SNE, SVD
```

---

## The 6 Notebook Files

| File | Job | Syllabus Lectures |
|---|---|---|
| `vayu_step1_setup.ipynb` | EDA — understand the raw data, no changes | 1–7 (prerequisite) |
| `vayu_step2_cleaning.ipynb` | Clean — fix sentinels, validate ranges, fill gaps, save master | 42–45 |
| `vayu_step3_regression.ipynb` | Build regression dataset — features, target, train/test split | 8–17 |
| `vayu_step4_classification.ipynb` | Build classification dataset — encode target, handle imbalance | 18–24, 31–36 |
| `vayu_step5_clustering.ipynb` | Build clustering dataset — city profiles from 277 bulletin files | 55–56 |
| `vayu_step6_dimensionality.ipynb` | Build dimensionality dataset — standardize pollutant matrix | 46–54 |

---

## What Each Notebook Does in Detail

---

### Step 1 — `vayu_step1_setup.ipynb`
**Purpose:** Exploratory Data Analysis. Look at the data without modifying anything.

**What it does:**
- Creates the 5 output folders with README files
- Loads `aqi_india_38cols_knn_final.csv` (842,160 rows, 29 cities)
- Prints a full column inventory with dtypes and null counts
- Visualizes column role distribution (Pollutant / Target / Identity / Datetime)
- Detects standard NaN and sentinel value 999 per column
- Plots geographic coverage (rows per city, imbalance ratio)
- Plots temporal coverage (rows per year, per month with winter highlighted)
- Shows raw pollutant distributions with physical valid limits marked
- Shows AQI and AQI_category distribution with class imbalance warning
- Plots raw correlation heatmap (pollutants vs AQI)

**Output:** No files written. Only visual understanding.

**Why no modifications here:** If you clean before looking, you risk making decisions based on wrong assumptions. The raw distributions give you the baseline you compare against after cleaning.

---

### Step 2 — `vayu_step2_cleaning.ipynb`
**Purpose:** Clean the primary dataset and save a master file. All subsequent notebooks read from this master.

**What it does:**
- Replaces sentinel value 999 with NaN across all pollutant columns
- Applies physical range validation — readings outside physically possible limits are nulled:
  - PM2.5 > 1000 µg/m³ → NaN
  - PM10 > 1500 µg/m³ → NaN
  - NO2 > 500 µg/m³ → NaN
  - SO2 > 500 µg/m³ → NaN
  - CO > 50 mg/m³ → NaN
  - O3 > 300 µg/m³ → NaN
- Forward fills short sensor dropout gaps (≤ 3 consecutive hours) within each city
- Drops rows where ALL pollutants are missing after filling
- Removes exact duplicates on city + datetime
- Parses and standardizes the datetime column
- Adds derived time features: year, month, day, hour, day_of_week, season
- Computes AQI_category if not already present using CPCB breakpoints
- Shows before/after comparison plots for every pollutant
- Shows before/after correlation heatmap
- Saves: `data/cleaned/05_shared/master_cleaned.parquet` and `.csv`

**Output:** `master_cleaned.parquet`, `master_cleaned.csv`, `cleaning_report.png`

---

### Step 3 — `vayu_step3_regression.ipynb`
**Purpose:** Prepare data specifically for Linear Regression and Multiple Regression (Lectures 8–17).

**What it does:**
- Reads `master_cleaned.parquet`
- Selects only columns needed for regression (see Data Requirements below)
- Drops any remaining rows with NaN in features or target
- Checks and visualizes feature-target correlations
- Checks for multicollinearity between features (VIF calculation)
- Applies log transformation to right-skewed pollutants if skewness > 2
- Splits into train/test (80/20) with stratification by city
- Saves: `data/cleaned/01_regression/regression_train.csv` and `regression_test.csv`
- Saves: `data/cleaned/01_regression/feature_list.txt`

**Output:** `regression_train.csv`, `regression_test.csv`, `feature_list.txt`

---

### Step 4 — `vayu_step4_classification.ipynb`
**Purpose:** Prepare data for classification models — Logistic Regression, KNN, SVM, Decision Trees, Random Forest (Lectures 18–24, 31–36, 56–60).

**What it does:**
- Reads `master_cleaned.parquet`
- Selects features and encodes the target (AQI_category → integer label)
- Checks class distribution and imbalance ratio
- If imbalance ratio > 3x: applies SMOTE oversampling on training set (Lectures 39–41)
- Applies StandardScaler to numeric features (required for KNN, SVM, Logistic Regression)
- Splits into train/test (80/20) stratified by AQI_category
- Saves scaled and unscaled versions (tree-based models don't need scaling)
- Saves label encoding map so categories can be decoded after prediction

**Output:** `classification_train.csv`, `classification_test.csv`, `label_map.json`, `scaler.pkl`

---

### Step 5 — `vayu_step5_clustering.ipynb`
**Purpose:** Prepare data for K-Means Clustering (Lectures 55–56). Uses the 277 bulletin files, not the primary dataset.

**What it does:**
- Reads and stacks all 277 `*_AQIBulletins.csv` files (one per city)
- Aggregates to city-level features: mean AQI per season, AQI standard deviation, most common prominent pollutant
- Standardizes all features (K-Means is distance-based — scale matters)
- Runs the Elbow Method to find the optimal number of clusters (K)
- Runs K-Means with the chosen K
- Visualizes clusters using PCA for 2D projection
- Labels each cluster (e.g. "High PM2.5 Industrial", "Moderate Urban", "Relatively Clean")
- Saves the city-cluster mapping

**Output:** `city_profiles.csv`, `city_clusters.csv`, `elbow_plot.png`

---

### Step 6 — `vayu_step6_dimensionality.ipynb`
**Purpose:** Prepare data for PCA, t-SNE, and SVD (Lectures 46–54).

**What it does:**
- Reads `master_cleaned.parquet`
- Extracts only the 6 pollutant columns (pure numeric matrix)
- Standardizes using StandardScaler (PCA is variance-based — scale matters)
- Runs PCA and shows explained variance ratio per component
- Shows the cumulative variance plot to decide how many components to keep
- Runs t-SNE on a 10,000-row sample (t-SNE is slow on full 842k rows)
- Colors the t-SNE scatter by city and by AQI_category to reveal structure
- Computes SVD and shows the singular value spectrum
- Saves the standardized pollutant matrix

**Output:** `pollutant_matrix_scaled.csv`, `pca_components.csv`, `tsne_sample.csv`

---

## Data Requirements Per Model

This section explains what each model needs from the data and why, mapped to your syllabus.

---

### Linear Regression + Multiple Regression
**Syllabus:** Lectures 8–17

**Target variable:** AQI — numeric, continuous (0–500)

**Features used:**

| Feature | Why it is included |
|---|---|
| PM2.5 | Strongest predictor of AQI in India. Accounts for the majority of AQI variation in northern cities. |
| PM10 | Second strongest predictor. Correlated with PM2.5 but adds independent signal from construction/road dust. |
| NO2 | Vehicle and industrial emissions. Important predictor in metro cities. |
| SO2 | Industrial and coal burning emissions. Less weight in metros, more in industrial zones. |
| CO | Combustion indicator. Correlated with vehicle density. |
| O3 | Ground-level ozone. Inversely correlated with other pollutants in some seasons. |
| month | Captures seasonality — pollution is higher in winter (Nov–Feb) due to meteorological factors. |
| hour | Captures diurnal variation — pollution peaks at rush hours and drops at night. |
| day_of_week | Weekend vs weekday traffic and industrial activity differences. |

**Features excluded:**

| Feature | Why it is excluded |
|---|---|
| city (raw text) | Cannot be used directly in linear regression. Would need one-hot encoding which creates 29 dummy columns — included in classification but kept simple for regression. |
| AQI_category | This is derived from AQI. Including it would be data leakage — the target is already embedded in this column. |
| NH3, NOx, Benzene | Not available across all cities consistently. Including sparse columns introduces bias. |

**Data requirements:**
- No NaN values in any feature or target column
- Features should be approximately normally distributed — log transform skewed columns
- No multicollinearity: if two features have correlation > 0.85, consider dropping one
- Train/test split: 80/20 stratified by city so all cities appear in both sets

---

### Logistic Regression, KNN, SVM, Decision Trees, Random Forest
**Syllabus:** Lectures 18–24, 31–36, 39–41, 56–60

**Target variable:** AQI_category — categorical with 6 classes:
`Good, Satisfactory, Moderate, Poor, Very Poor, Severe`

**Features used:** Same 6 pollutants + time features as regression, plus:

| Additional Feature | Why it is included |
|---|---|
| city (encoded) | Classification models can handle encoded categoricals. City encodes geographic and industrial context. |
| season | Explicit season label (Winter/Summer/Monsoon/Spring) is more interpretable than month number for tree-based models. |

**Features excluded:** Same as regression, plus raw AQI numeric (would cause perfect prediction — direct data leakage).

**Data requirements:**
- Target must be integer-encoded (Good=0, Satisfactory=1, Moderate=2, Poor=3, Very Poor=4, Severe=5)
- Features must be standardized for KNN and SVM (distance-based models — Lectures 31–32)
- Features do NOT need to be standardized for Decision Trees and Random Forest (split-based)
- Class imbalance must be checked — if Severe class is < 5% of data, use SMOTE or `class_weight='balanced'` (Lectures 39–41)
- Train/test split: 80/20 stratified by AQI_category so all classes appear in both sets

**Why class imbalance matters here:** India's AQI data is dominated by Moderate and Poor readings. Good and Severe are rare. A naive model will learn to always predict Moderate and still get 60% accuracy — but it will never correctly identify the dangerous Severe days, which are the most important to predict correctly.

---

### K-Means Clustering
**Syllabus:** Lectures 55–56

**Target variable:** None — unsupervised

**Input data:** City-level aggregated profile, one row per city

**Features used:**

| Feature | Why it is included |
|---|---|
| mean_AQI_winter | Average AQI in Nov–Feb. Differentiates northern plains cities from southern cities. |
| mean_AQI_summer | Average AQI in Mar–May. Shows which cities have summer ozone problems. |
| mean_AQI_monsoon | Average AQI in Jun–Sep. Monsoon suppresses pollution — low values here indicate meteorological sensitivity. |
| aqi_std | Standard deviation of daily AQI. High std = volatile air quality (event-driven, e.g. Diwali spikes). |
| prominent_pm25_pct | Fraction of days where PM2.5 was the prominent pollutant. Indicates particulate-dominated cities. |
| prominent_o3_pct | Fraction of days where O3 was prominent. Indicates ozone-dominated cities (usually southern). |

**Source:** 277 AQI Bulletin files (one per city). NOT the primary dataset — bulletins cover more cities.

**Data requirements:**
- One row per city — no row-level data, only aggregated statistics
- All features must be numeric
- All features must be StandardScaler normalized — K-Means is distance-based, so a feature with a large range (e.g., AQI 0–500) will dominate over a small-range feature (e.g., a percentage 0–1)
- No target column in the input — K-Means does not use labels

**Why not use the primary file for clustering:** The primary file has only 29 cities. The bulletin files cover 277 cities, giving a much richer geographic picture of India's air quality landscape.

---

### PCA, t-SNE, SVD
**Syllabus:** Lectures 46–54

**Target variable:** None — unsupervised dimensionality reduction

**Input data:** Pure pollutant feature matrix from the primary file

**Features used:** PM2.5, PM10, NO2, SO2, CO, O3 — the 6 raw pollutant concentrations only

**Features excluded:** All time features, all categorical features, AQI, AQI_category

**Data requirements:**
- Purely numeric matrix — no text, no NaN, no categorical columns
- Must be StandardScaler normalized before PCA and t-SNE (both are variance/distance-based)
- SVD can optionally be run on the raw matrix to understand explained variance
- t-SNE is computationally expensive — run on a random sample of 10,000 rows from the full dataset

**Why only the 6 pollutants:** PCA finds directions of maximum variance. Time features (hour, month) introduce variance that reflects data collection patterns rather than air quality patterns. We want the principal components to reflect pollutant co-occurrence patterns — which pollutants tend to be high together — not time patterns.

**What to expect from PCA output:**
- PC1 will likely explain ~50–60% of variance and will be a general "pollution level" axis
- PC2 will likely separate ozone-dominated cities from particulate-dominated cities
- A 2D scatter of PC1 vs PC2 colored by city should show geographic clustering

---

## File Source Summary

| Output Folder | Primary Source | Why This Source | Files Rejected |
|---|---|---|---|
| `05_shared` | `aqi_india_38cols_knn_final.csv` | 842k rows, all 6 pollutants, 29 cities, already imputed | All other files |
| `01_regression` | `05_shared/master_cleaned.parquet` | Needs numeric AQI + pollutant features | Bulletin files (no raw pollutants) |
| `02_classification` | `05_shared/master_cleaned.parquet` | Needs AQI_category + pollutant features | Bulletin files (no raw pollutants) |
| `03_clustering` | All 277 `*_AQIBulletins.csv` files | Needs 277+ cities for meaningful clustering | Primary file (only 29 cities) |
| `04_dimensionality` | `05_shared/master_cleaned.parquet` | Needs raw pollutant concentrations | Bulletin files (no raw pollutants) |

---

## Cleaning Operations Summary

| Operation | What It Fixes | Where Applied |
|---|---|---|
| Replace 999 → NaN | Sentinel values (CPCB sensor error code) | All numeric columns in primary file |
| Range validation | Physically impossible readings (e.g., PM2.5 > 1000) | All 6 pollutant columns |
| Forward fill (limit=3) | Short sensor dropout gaps ≤ 3 consecutive hours | Pollutant columns, within each city group |
| Drop all-null rows | Rows where every pollutant is NaN after filling | All rows |
| Deduplication | Exact duplicate city + datetime rows | All rows |
| Datetime parsing | Inconsistent date string formats | datetime column |
| Time feature extraction | year, month, day, hour, day_of_week, season | New derived columns |
| AQI_category derivation | Add category label if not present | Derived from AQI using CPCB breakpoints |

---

## Quick Reference — Which Step to Open for What

| You want to... | Open this notebook |
|---|---|
| Understand the raw data | Step 1 |
| Clean the data | Step 2 |
| Train a regression model | Step 3 (then use `01_regression/`) |
| Train a classifier | Step 4 (then use `02_classification/`) |
| Cluster cities by pollution profile | Step 5 (then use `03_clustering/`) |
| Run PCA or t-SNE | Step 6 (then use `04_dimensionality/`) |
| Check why a file was rejected | README.txt inside the relevant folder |
