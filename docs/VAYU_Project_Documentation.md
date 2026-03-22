# VAYU — Complete Data Preparation Documentation

**Project:** Predictive Modeling and Unsupervised Clustering of Ambient Air Quality Across Indian Urban Centres Using CPCB Sensor Data

---

## Table of Contents

1. [Dataset Overview](#1-dataset-overview)
2. [Raw Data Inventory](#2-raw-data-inventory)
3. [Pipeline Architecture](#3-pipeline-architecture)
4. [Step-by-Step Breakdown](#4-step-by-step-breakdown)
5. [Data Requirements Per Model](#5-data-requirements-per-model)
6. [Cleaning Operations Reference](#6-cleaning-operations-reference)
7. [Output Files Reference](#7-output-files-reference)
8. [Known Issues and Fixes Applied](#8-known-issues-and-fixes-applied)
9. [Quick Reference](#9-quick-reference)

---

## 1. Dataset Overview

**Primary source:** `aqi_india_38cols_knn_final.csv`
- 842,160 rows across 29 Indian cities
- Hourly data from 2015 to 2024
- All 6 CPCB pollutants: PM2.5, PM10, NO2, SO2, CO, O3
- Already KNN-imputed — 0% standard NaN before cleaning
- Contains sentinel value 999 (CPCB code for sensor error) — requires cleaning

**Secondary source:** 277 `*_AQIBulletins.csv` files
- One file per Indian city, daily AQI data
- Covers 277 cities across all states
- Schema: `date | City | No. Stations | Air Quality | Index Value | Prominent Pollutant`
- No raw pollutant readings — only the final aggregated AQI value
- Used exclusively for the clustering task (Step 5)

**Total raw files scanned:** 299 (CSV + XLSX)

---

## 2. Raw Data Inventory

### Schema Types Found Across 299 Files

| Schema | Files | Rows | Used For | Why Others Rejected |
|---|---|---|---|---|
| Multi-city Historical | 2 | 1,684,320 | Regression, Classification, Dimensionality | Primary source — all pollutants + long temporal coverage |
| Real-time Wide | 5 | 231,654 | Validation / supplementary | Smaller coverage, some lack CO |
| AQI Bulletin | 277 | 299,972 | Clustering | No raw pollutant readings |
| Raw Hourly Sensor (CAAQMS) | 1 | 59,150 | Supplementary | Single station only |
| Long Format | 3 | 9,792 | Not used in pipeline | Snapshot only, no temporal depth |
| Weather + PM2.5 only | 1 | 2,192 | Rejected | 50% missing, no datetime column |
| Malformed JSON export | 1 | 31 | Rejected | 31 rows × 6011 cols — broken export |

### Why `aqi_india_38cols_knn_final.csv` Was Chosen as Primary

1. **Coverage:** 842,160 rows is the largest single file — enough for train/test splits without data starvation
2. **Completeness:** Already KNN-imputed so 0% standard NaN — reduces cleaning complexity
3. **Temporal depth:** 2015–2024 spans 9 years, capturing multiple seasonal cycles and long-term trends
4. **Pollutant coverage:** All 6 CPCB pollutants present in a single file
5. **City coverage:** 29 cities across north, south, east, and west India

### Why Bulletin Files Were Chosen for Clustering

1. **Geographic breadth:** 277 cities vs 29 in the primary file — much richer geographic picture
2. **Clean structure:** Every bulletin file has the same 6-column schema — easy to stack
3. **Purpose fit:** Clustering needs one row per entity (city), not hourly rows — bulletins aggregate naturally to city-level profiles

---

## 3. Pipeline Architecture

```
Raw Data (299 files)
        │
        ▼
vayu_step1_setup.ipynb
  ─ EDA: understand before touching
  ─ Column inventory, dtype check
  ─ Sentinel detection, coverage maps
  ─ Output: nothing saved — observation only
        │
        ▼
vayu_step2_cleaning.ipynb
  ─ Replace sentinel 999 → NaN
  ─ Physical range validation (unit-aware)
  ─ Forward fill short gaps (limit=3 hours)
  ─ Drop all-null rows, deduplicate
  ─ Parse datetime, add time features
  ─ Derive AQI_category
  ─ Output: data/cleaned/05_shared/master_cleaned.parquet + .csv
        │
   ┌────┴─────────────────────────────────────┐
   │                                          │
   ▼                                          ▼
vayu_step3_regression.ipynb        vayu_step5_clustering.ipynb
  ─ Compute AQI from pollutants       ─ Reads 277 bulletin files
  ─ Select pollutant + time features   ─ Aggregates to city profiles
  ─ Log-transform skewed features      ─ Elbow + silhouette for K
  ─ Check VIF / multicollinearity      ─ K-Means clustering
  ─ Winsorize outliers                 ─ PCA cluster visualization
  ─ 80/20 split stratified by city     ─ Output: 03_clustering/
  ─ Output: 01_regression/
   │
   ▼
vayu_step4_classification.ipynb
  ─ Standardize AQI_category labels
  ─ Label-encode city + season
  ─ SMOTE if imbalance > 3x
  ─ StandardScaler (for KNN/SVM/LogReg)
  ─ 80/20 split stratified by class
  ─ Output: 02_classification/ (scaled + unscaled)
   │
   ▼
vayu_step6_dimensionality.ipynb
  ─ Extract pure pollutant matrix
  ─ StandardScaler normalization
  ─ PCA: scree plot, loadings, 2D scatter
  ─ SVD: singular value spectrum
  ─ t-SNE: 15k sample, 3 perplexity values
  ─ Output: 04_dimensionality/
```

---

## 4. Step-by-Step Breakdown

---

### Step 1 — `vayu_step1_setup.ipynb`

**Purpose:** Exploratory Data Analysis. Nothing is modified. This step builds understanding.

**What it does:**

- Creates the 5 output folders (`01_regression` through `05_shared`) with README files explaining what each folder is for, which source files feed it, and which files were rejected
- Loads the primary dataset and prints every column with dtype and null count
- Tags each column as POLLUTANT / TARGET / IDENTITY / DATETIME / OTHER using keyword matching
- Detects and counts sentinel value 999 per column — this is the key diagnostic
- Plots geographic coverage: rows per city, imbalance ratio (red = city with too few rows for fair representation)
- Plots temporal coverage: rows per year (checks for data gaps), rows per month with winter highlighted (Nov–Feb = peak pollution season)
- Plots raw pollutant histograms with physical valid limits marked as red dashed lines — the sentinel 999 spike should be visible as a bar far to the right
- Plots AQI and AQI_category distribution with class imbalance warning
- Plots raw correlation heatmap — distorted by sentinels, shows baseline before cleaning

**Output:** Nothing saved. Only visual understanding.

**Why no modifications here:** Cleaning decisions should be made with full knowledge of the data. The raw distributions are the baseline you compare against after cleaning.

---

### Step 2 — `vayu_step2_cleaning.ipynb`

**Purpose:** Fix all data quality issues and produce the master cleaned file.

**Operations performed in order:**

**Operation 1 — Replace sentinel 999 → NaN**

CPCB's CAAQMS system records exactly 999 when a sensor fails or goes offline. This is confirmed by the pattern: values are always exactly 999 (not 998 or 1000), and they cluster at station reset times. PM2.5 of 999 µg/m³ is physically impossible — the highest ever recorded real reading in India was approximately 900 µg/m³ during severe Diwali pollution. We replace all 999 values across all numeric columns with NaN.

**Operation 2 — Physical range validation**

Even after removing 999, sensors can malfunction and output values that are wrong but not exactly 999. Each pollutant has a physically grounded maximum:

| Pollutant | Unit | Valid Maximum | Scientific Basis |
|---|---|---|---|
| PM2.5 | µg/m³ | 1,000 | Exceeds worst recorded global events |
| PM10 | µg/m³ | 1,500 | Includes extreme dust storm readings |
| NO2 | µg/m³ | 500 | Industrial accident levels |
| SO2 | µg/m³ | 500 | Industrial accident levels |
| CO | µg/m³ | 50,000 | 50 mg/m³ × 1000 = 50,000 µg/m³ |
| CO | mg/m³ | 50 | NIOSH immediately dangerous level |
| O3 | µg/m³ | 300 | Above any recorded ambient level |
| NH3 | µg/m³ | 400 | Industrial zone maximum |

**Critical unit note for CO:** The primary file stores CO as `co_ugm3` (micrograms per cubic metre). The CPCB safe limit is 50 mg/m³. Since 1 mg = 1000 µg, the correct upper limit is 50,000 µg/m³ — not 50. Using 50 as the limit would null every valid CO reading. The code detects `ugm3` in the column name and applies the correct limit table automatically.

**Operation 3 — Forward fill short sensor gaps**

After nulling sentinel and invalid values, some rows have NaN for one or more pollutants. These NaNs come from short sensor dropouts (1–3 hours) where the sensor went offline briefly and then came back. Since pollutant concentrations change slowly over a few hours, it is reasonable to carry the last known reading forward for up to 3 consecutive missing values.

We use `.ffill(limit=3)` applied within each city group separately — so Delhi readings never bleed into Mumbai. Gaps longer than 3 hours stay as NaN and are handled in the next step.

**Operation 4 — Drop all-null rows**

Rows where every pollutant column is NaN after forward fill represent extended sensor outages that we cannot reliably fill. We drop these rows. Rows with NaN in only some pollutants are kept — the individual steps (regression, classification) handle remaining NaN in their own targeted way.

**Operation 5 — Deduplicate**

CPCB data exported in overlapping date ranges can produce exact duplicate rows. We deduplicate on the combination of city + datetime, keeping the first occurrence.

**Operation 6 — Parse datetime and extract time features**

The datetime column is parsed using `pd.to_datetime`. The following features are extracted if not already present:

| Feature | Range | Why Useful |
|---|---|---|
| `year` | 2015–2024 | Captures long-term trend (air quality improving or worsening over years) |
| `month` | 1–12 | Captures seasonality — winter months have systematically higher AQI |
| `day` | 1–31 | Day-of-month pattern |
| `hour` | 0–23 | Diurnal pattern — rush hour peaks at 8–10 AM and 6–8 PM |
| `day_of_week` | 0–6 | Weekly pattern — weekends have lower industrial and traffic emissions |
| `season` | 4 values | Winter / Spring / Summer / Monsoon — explicit seasonal label for tree models |

**Operation 7 — Derive AQI_category**

If a numeric AQI column exists, we derive the 6-class category using CPCB breakpoints. If a category column already exists, we standardize its string values (handle inconsistent casing like `Very  Poor` → `Very Poor`).

**Result for primary dataset:** 0 rows were dropped. This is expected — the KNN-imputed file had no extended outages and no duplicates. The cleaning operations replaced values in-place (sentinel → NaN) rather than deleting rows.

**Output files:**

| File | Size | Description |
|---|---|---|
| `05_shared/master_cleaned.parquet` | ~30 MB | Binary compressed — use this in Steps 3–6 |
| `05_shared/master_cleaned.csv` | ~150 MB | Human readable backup |
| `05_shared/cleaning_log.csv` | <1 MB | Every operation logged with before/after row counts |

---

### Step 3 — `vayu_step3_regression.ipynb`

**Purpose:** Build the dataset for Linear Regression and Multiple Regression.

**Model:** Linear Regression, Multiple Regression *(Lectures 8–17)*

**Target variable:** AQI — numeric, continuous, range 0–500

**Features selected:**

| Feature | Type | Why Included |
|---|---|---|
| PM2.5 | Pollutant | Strongest predictor of AQI in India. Dominant in northern cities. |
| PM10 | Pollutant | Independent signal from road and construction dust |
| NO2 | Pollutant | Vehicle and industrial emissions. Key predictor in metros. |
| SO2 | Pollutant | Coal burning. More weight in industrial cities. |
| CO | Pollutant | Combustion indicator. Correlated with traffic density. |
| O3 | Pollutant | Ground-level ozone. Adds independent signal in summer/south. |
| month | Time | Captures seasonality — Jan readings are higher than July. |
| hour | Time | Captures rush hour peaks. |
| day_of_week | Time | Weekend vs weekday emissions differences. |

**Features excluded:**

| Feature | Reason |
|---|---|
| city (text) | Cannot use raw text in linear regression without encoding. Kept simple for regression. |
| AQI_category | Derived from AQI — including it in features is direct data leakage. |
| year | Would make the model extrapolate by year rather than by pollution level. |
| season (text) | Captured by month already. Tree models in Step 4 use this. |
| NH3, NOx | Not present consistently across all cities. |

**Operations performed:**

1. **Compute AQI** from pollutants using CPCB sub-index formula if not already present
2. **Drop NaN rows** in any feature or target column — regression cannot handle NaN
3. **Skewness check** per pollutant — features with skewness > 2.0 are right-skewed (long tail from pollution spikes). These are log-transformed using `log1p(x)` to bring them closer to normal
4. **Multicollinearity check** — Pearson correlation matrix between all features. If `|r| > 0.85`, the two features are highly collinear and one should be dropped. VIF (Variance Inflation Factor) is computed where statsmodels is available
5. **Winsorization** at the 99th percentile — values above the 99th percentile are capped at that value. This limits the influence of genuine but extreme pollution spikes on the regression line
6. **Train/test split:** 80/20, stratified by city so all 29 cities appear in both sets

**Output files:**

| File | Description |
|---|---|
| `01_regression/regression_train.csv` | 80% of cleaned data — features + AQI target |
| `01_regression/regression_test.csv` | 20% holdout — never used during training |
| `01_regression/feature_list.txt` | Exact column names to pass to the model, with notes on which were log-transformed |

---

### Step 4 — `vayu_step4_classification.ipynb`

**Purpose:** Build the dataset for all classification models.

**Models:** Logistic Regression, KNN, SVM, Decision Trees, Random Forest *(Lectures 18–24, 31–36, 56–60)*

**Target variable:** `AQI_label` — integer 0–5 encoding of AQI_category

| Integer | Category | AQI Range |
|---|---|---|
| 0 | Good | 0–50 |
| 1 | Satisfactory | 51–100 |
| 2 | Moderate | 101–200 |
| 3 | Poor | 201–300 |
| 4 | Very Poor | 301–400 |
| 5 | Severe | 401–500 |

**Features selected:**

Same 6 pollutants as regression, plus:

| Additional Feature | Why Added for Classification |
|---|---|
| city_enc | City label-encoded to integer. Classification models (especially trees) can use this. Captures city-level baseline pollution. |
| month | Seasonality signal |
| hour | Diurnal signal |
| day_of_week | Weekly emissions cycle |
| season_enc | Explicit season label (Winter=0, Spring=1, Summer=2, Monsoon=3). Added if `season` column exists. |

**Features excluded:**

| Feature | Reason |
|---|---|
| AQI (numeric) | Direct data leakage — the target is derived from this column. Including it would give perfect accuracy. |
| AQI_category (string) | Same leakage issue as above. |
| year | Not useful for prediction — would create spurious temporal trend fitting. |
| NH3, cloud_cover | NH3 absent in many rows; cloud_cover is weather, not a pollutant. |

**Operations performed:**

1. **Standardize AQI_category** — flexible mapping handles any casing or spacing variant (`very  poor`, `Very Poor`, `VERY POOR` all → `Very Poor`)
2. **Drop NaN category rows** — rows that could not be mapped to a valid category are removed
3. **Label encode city** — LabelEncoder converts city names to integers 0 to N-1. Mapping saved to `label_map.json`
4. **Encode season** — text season to integer using fixed map
5. **Drop all-NaN features** — if a feature column is entirely NaN (e.g., `season_enc` when `season` column doesn't exist in the file), it is removed from the feature list automatically before dropna runs. This prevents the silent "0 rows remain" failure
6. **Train/test split:** 80/20, stratified by `AQI_label` — ensures all 6 classes appear in both sets
7. **SMOTE oversampling** on training set only if imbalance ratio > 3x. Test set is never modified — it must reflect real-world class distribution for honest evaluation. SMOTE generates synthetic minority-class samples by interpolating between existing samples rather than duplicating
8. **StandardScaler** fitted on training set only, transforms both train and test. Two versions saved:
   - Scaled: for Logistic Regression, KNN, SVM (distance-based)
   - Unscaled: for Decision Trees, Random Forest (threshold-based, scaling has no effect)

**Output files:**

| File | Use With |
|---|---|
| `02_classification/clf_train_scaled.csv` | Logistic Regression, KNN, SVM |
| `02_classification/clf_train_unscaled.csv` | Decision Trees, Random Forest |
| `02_classification/clf_test_scaled.csv` | Test set for Logistic Regression, KNN, SVM |
| `02_classification/clf_test_unscaled.csv` | Test set for Decision Trees, Random Forest |
| `02_classification/label_map.json` | Decode predictions back to category names |
| `02_classification/feature_list.txt` | Feature list + guide for which file to use |

**Result:** 417,847 train rows, 104,462 test rows, 10 features, 6 classes. SMOTE not applied (imbalance < 3x).

---

### Step 5 — `vayu_step5_clustering.ipynb`

**Purpose:** Build the dataset for K-Means clustering of Indian cities by pollution signature.

**Model:** K-Means Clustering *(Lectures 55–56)*

**Source data:** 277 `*_AQIBulletins.csv` files (NOT the master cleaned file)

**Why bulletin files, not the primary dataset:**

The primary dataset covers only 29 cities. K-Means clustering of 29 points would produce broad, hard-to-interpret clusters. The 277 bulletin files cover the full geographic spread of India — industrial cities in Maharashtra, coal belt cities in Jharkhand, hill stations in Himachal, coastal cities in Kerala. This geographic richness is what makes the clustering meaningful.

**City profile features built:**

| Feature | Construction | What It Captures |
|---|---|---|
| `mean_aqi` | Mean of all daily AQI values | Overall chronic pollution level |
| `median_aqi` | Median of all daily AQI values | Typical pollution level (robust to extreme events) |
| `std_aqi` | Standard deviation of daily AQI | Volatility — does AQI swing wildly or stay flat? |
| `mean_aqi_winter` | Mean AQI in Nov/Dec/Jan/Feb | Winter-specific pollution (stubble burning, temperature inversion) |
| `mean_aqi_summer` | Mean AQI in Mar/Apr/May | Summer-specific pollution (dust, heat-driven chemistry) |
| `mean_aqi_monsoon` | Mean AQI in Jun–Sep | Monsoon suppression — cities that benefit most from rain |
| `pct_poor_or_worse` | % of days with AQI > 200 | Chronic bad air quality frequency |
| `pct_pm25_dominant` | % of days PM2.5 was prominent pollutant | Particulate-driven pollution signature (northern cities) |
| `pct_pm10_dominant` | % of days PM10 was prominent | Dust-driven pollution signature (construction zones) |
| `pct_o3_dominant` | % of days O3 was prominent | Ozone-driven signature (southern cities, summer) |

**Operations performed:**

1. **Stack all 277 files** — handle encoding, standardize column names, infer city from filename if column absent
2. **Build city profiles** — one row per city using `.groupby().agg()` (avoids pandas 2.2 `KeyError` from `apply`)
3. **Drop cities with incomplete profiles** — cities with NaN in any clustering feature are excluded
4. **StandardScaler normalization** — mandatory for K-Means (distance-based algorithm)
5. **Elbow method** — plot inertia vs K for K=2 to 12
6. **Silhouette score** — computed for each K; the K with the highest score is recommended
7. **Final K-Means** run with chosen K using `n_init=20` for stability
8. **PCA projection** to 2D for cluster visualization
9. **Auto-labeling** — clusters ranked by mean AQI and assigned descriptive labels

**Result:** 277 cities profiled, 229 with complete data, K=2 chosen (silhouette score 0.378). Two clusters found: relatively clean cities (mostly southern/hill) vs heavily polluted cities (mostly northern plains/industrial).

**Output files:**

| File | Description |
|---|---|
| `03_clustering/city_profiles.csv` | 277 rows, one per city, all feature values |
| `03_clustering/city_clusters.csv` | City profiles with cluster assignment and label |
| `03_clustering/city_profiles_scaled.csv` | Scaled features + cluster labels — use directly with KMeans |
| `03_clustering/bulletins_stacked.csv` | All 277 files stacked — use for time-series analysis |

---

### Step 6 — `vayu_step6_dimensionality.ipynb`

**Purpose:** Apply PCA, SVD, and t-SNE to the pollutant feature space.

**Techniques:** PCA, t-SNE, SVD *(Lectures 46–54)*

**Source data:** `05_shared/master_cleaned.parquet`

**Features used:** Pollutant columns only (PM2.5, PM10, NO2, SO2, CO, O3). No time features, no categorical features.

**Why only the 6 pollutant columns:**

PCA finds directions of maximum variance. If we include time features (month, hour), the principal components would reflect temporal patterns rather than pollutant co-occurrence. We want PC1 to mean "general pollution level" and PC2 to mean "PM-heavy vs ozone-heavy" — not "morning vs afternoon". Including non-pollutant features would muddy those interpretations.

**Operations performed:**

**PCA:**
1. Fit StandardScaler on the full pollutant matrix
2. Run full PCA (all N components where N = number of pollutants)
3. Compute and plot explained variance per component (scree plot)
4. Compute and plot cumulative variance — find how many components needed for 90% and 95%
5. Plot component loadings heatmap — shows which pollutants define each PC
6. Run 2D PCA projection, scatter plot colored by city and by AQI category

**SVD:**
1. Run TruncatedSVD on scaled matrix
2. Plot singular value spectrum
3. Compute effective rank — how many dimensions are needed to represent the data
4. Compare explained variance to PCA output (should match — PCA is SVD of the covariance matrix)

**t-SNE:**
1. Sample 15,000 rows randomly (t-SNE is O(n²) — cannot run on full 842k)
2. Pre-reduce to 10 PCA components for speed (standard practice before t-SNE)
3. Run t-SNE with perplexity=50
4. Plot scatter colored by AQI category and by PM2.5 value
5. Run perplexity sensitivity check with 3 values (10, 30, 100) on a 5,000-row sub-sample to confirm results are robust

**Output files:**

| File | Description |
|---|---|
| `04_dimensionality/pollutant_matrix_scaled.csv` | StandardScaler-normalized pollutant matrix with city/category metadata |
| `04_dimensionality/pca_components.csv` | All PC coordinates for every row |
| `04_dimensionality/pca_loadings.csv` | Component loadings + explained variance — use for interpretation |
| `04_dimensionality/tsne_sample.csv` | t-SNE 2D coordinates for the 15k sample with original pollutant values |

---

## 5. Data Requirements Per Model

---

### Linear Regression / Multiple Regression

| Requirement | Detail |
|---|---|
| Target type | Numeric continuous (float) — AQI 0–500 |
| Features | 6 pollutants + month, hour, day_of_week |
| Missing values | None allowed in any feature or target row |
| Scaling | Not required for the algorithm itself, but log-transforming skewed features improves fit |
| Outliers | Cap at 99th percentile (Winsorization) — a single extreme point can drag the regression line |
| Multicollinearity | Check `|r| > 0.85` between feature pairs. High VIF (>10) = feature should be dropped or merged |
| Split strategy | 80/20 stratified by city |
| Class balance | Not applicable |
| File to use | `01_regression/regression_train.csv` and `regression_test.csv` |

**Key assumption:** Linear regression assumes a linear relationship between each feature and the target. PM2.5 and AQI are computed to have a near-linear relationship by design (the sub-index formula is linear within each breakpoint band). This makes PM2.5 an ideal feature for linear regression on AQI.

---

### Logistic Regression

| Requirement | Detail |
|---|---|
| Target type | Integer label 0–5 (AQI_category encoded) |
| Features | 6 pollutants + city_enc + month, hour, day_of_week, season_enc |
| Missing values | None allowed |
| Scaling | **Required** — gradient descent for logistic regression converges much faster with scaled features |
| Class balance | Use `class_weight='balanced'` or SMOTE if imbalance ratio > 3x |
| Split strategy | 80/20 stratified by AQI_label |
| File to use | `02_classification/clf_train_scaled.csv` |

---

### KNN (K-Nearest Neighbors)

| Requirement | Detail |
|---|---|
| Target type | Integer label 0–5 |
| Features | Same as logistic regression |
| Missing values | None allowed |
| Scaling | **Critical** — KNN computes Euclidean distance. PM2.5 (0–1000) would completely dominate hour (0–23) without scaling |
| Class balance | SMOTE recommended if severe imbalance (> 5x) |
| Split strategy | 80/20 stratified by AQI_label |
| File to use | `02_classification/clf_train_scaled.csv` |

**Note on K selection:** Use cross-validation to find optimal K. Typically K=5 or K=10 works well. Higher K = smoother decision boundary but may underfit. Lower K = can overfit to noise.

---

### SVM (Support Vector Machine)

| Requirement | Detail |
|---|---|
| Target type | Integer label 0–5 |
| Features | Same as logistic regression |
| Missing values | None allowed |
| Scaling | **Critical** — SVM kernel functions are distance-based. Unscaled features produce incorrect support vectors |
| Class balance | Use `class_weight='balanced'` in SVC |
| Split strategy | 80/20 stratified by AQI_label |
| File to use | `02_classification/clf_train_scaled.csv` |

**Warning:** SVM on 840k rows is extremely slow (quadratic in number of support vectors). Use a random sample of 50,000–100,000 rows or use LinearSVC which scales better.

---

### Decision Trees

| Requirement | Detail |
|---|---|
| Target type | Integer label 0–5 |
| Features | Same as logistic regression |
| Missing values | None allowed in sklearn implementation |
| Scaling | **Not required** — decision trees use thresholds, not distances. Scaling has zero effect on split quality |
| Class balance | Use `class_weight='balanced'` |
| Split strategy | 80/20 stratified by AQI_label |
| File to use | `02_classification/clf_train_unscaled.csv` |

---

### Random Forest

| Requirement | Detail |
|---|---|
| Target type | Integer label 0–5 |
| Features | Same as logistic regression |
| Missing values | None allowed |
| Scaling | **Not required** — ensemble of decision trees |
| Class balance | Use `class_weight='balanced'` |
| Split strategy | 80/20 stratified by AQI_label |
| File to use | `02_classification/clf_train_unscaled.csv` |

---

### K-Means Clustering

| Requirement | Detail |
|---|---|
| Target variable | None — unsupervised |
| Input | One row per city (city-level aggregated profile) |
| Features | mean_aqi, std_aqi, seasonal means, pct_poor_or_worse, pollutant dominance percentages |
| Missing values | None allowed — drop cities with incomplete profiles |
| Scaling | **Critical** — K-Means uses Euclidean distance. StandardScaler mandatory |
| K selection | Elbow method + silhouette score |
| File to use | `03_clustering/city_profiles_scaled.csv` |

**Important:** K-Means assumes clusters are spherical and roughly equal-sized. If some clusters are much larger than others (as seen with K=2 in this dataset), consider trying K=3 or K=4 for more granular groupings.

---

### PCA / t-SNE / SVD

| Requirement | Detail |
|---|---|
| Target variable | None — unsupervised |
| Input | Pure pollutant concentration matrix — no text, no time features |
| Missing values | None allowed — drop rows with any NaN pollutant |
| Scaling | **Critical for PCA and t-SNE** — variance-based and distance-based respectively |
| t-SNE sample size | Maximum ~15,000 rows — memory complexity is O(n²) |
| File to use | `04_dimensionality/pollutant_matrix_scaled.csv` |

---

## 6. Cleaning Operations Reference

| Operation | What It Fixes | Applied To | Rows Dropped? |
|---|---|---|---|
| Replace 999 → NaN | Sentinel values (CPCB sensor error code) | All numeric columns | No — values replaced in place |
| Range validation (unit-aware) | Physically impossible readings | All pollutant columns | No — values nulled in place |
| Forward fill (limit=3) | Short sensor dropout gaps ≤ 3 hours | Pollutant columns within each city | No — NaN values filled |
| Drop all-null pollutant rows | Extended outages — all 6 pollutants missing | All rows | Yes — if all pollutants are NaN |
| Deduplication | Duplicate city + datetime rows | All rows | Yes — if exact duplicate |
| Datetime parsing | Inconsistent date string formats | datetime column | No |
| Time feature extraction | Create year/month/day/hour/season | New columns added | No |
| AQI_category derivation | Add category label if not present | New column added | No |
| Season NaN removal | season_enc column all-NaN when source column absent | Feature list updated | No — feature removed, not rows |
| Category standardization | Inconsistent casing/spacing in category strings | AQI_category column | No |

---

## 7. Output Files Reference

```
data/cleaned/
│
├── 05_shared/
│   ├── master_cleaned.parquet      ← Primary output of Step 2. Use this in Steps 3, 4, 6.
│   ├── master_cleaned.csv          ← Same data, human-readable backup.
│   └── cleaning_log.csv            ← Every cleaning operation logged with row counts.
│
├── 01_regression/
│   ├── regression_train.csv        ← Features + AQI target. 80% of clean data.
│   ├── regression_test.csv         ← 20% holdout. Never touch during training.
│   └── feature_list.txt            ← Exact column names + log-transform notes.
│
├── 02_classification/
│   ├── clf_train_scaled.csv        ← Scaled. Use for Logistic Regression, KNN, SVM.
│   ├── clf_train_unscaled.csv      ← Unscaled. Use for Decision Trees, Random Forest.
│   ├── clf_test_scaled.csv         ← Test set — scaled version.
│   ├── clf_test_unscaled.csv       ← Test set — unscaled version.
│   ├── label_map.json              ← {0: "Good", 1: "Satisfactory", ...}
│   └── feature_list.txt            ← Feature list + usage guide.
│
├── 03_clustering/
│   ├── city_profiles.csv           ← 277 cities × feature values (unscaled, readable).
│   ├── city_clusters.csv           ← City profiles + cluster assignment + cluster label.
│   ├── city_profiles_scaled.csv    ← Scaled features + cluster labels. Use with KMeans.
│   └── bulletins_stacked.csv       ← All 277 bulletin files stacked. For time-series work.
│
└── 04_dimensionality/
    ├── pollutant_matrix_scaled.csv ← StandardScaler-normalized pollutant matrix.
    ├── pca_components.csv          ← PC1–PC6 coordinates for every row.
    ├── pca_loadings.csv            ← Which pollutants define each PC + variance explained.
    └── tsne_sample.csv             ← t-SNE 2D coordinates for 15k-row sample.
```

---

## 8. Known Issues and Fixes Applied

### Issue 1 — `cloud_cover_percent` detected as pollutant column

**Cause:** The keyword `co` is a substring of `cloud_cover`. Using `'co'` as a keyword matched unintended columns.

**Fix:** Changed to `'co_'` (with underscore) so it only matches columns like `co_ugm3`. Added `EXCLUDE_KEYWORDS` list (`cloud, cover, humidity, temp, pressure, wind, rain, solar`) as a second filter.

---

### Issue 2 — CO range validation nulled 842,000 valid readings

**Cause:** CO valid range was set to `(0, 50)` — correct for mg/m³. But the file stores CO as `co_ugm3` (micrograms per cubic metre). 50 µg/m³ is an absurdly small value that every real CO reading exceeds.

**Fix:** Created two range tables: `VALID_RANGES_UGM3` and `VALID_RANGES_MGM3`. The code detects `ugm3` in the column name and selects the correct table. CO limit in µg/m³ is `50,000` (= 50 mg/m³ × 1000).

---

### Issue 3 — `fillna(method='ffill')` TypeError in pandas ≥ 2.1

**Cause:** The `method` parameter was deprecated in pandas 2.1 and raises `TypeError` in 2.2+.

**Fix:** Replaced `fillna(method='ffill', limit=3)` with `.ffill(limit=3)` throughout.

---

### Issue 4 — `groupby().apply()` KeyError on `city` column in pandas ≥ 2.2

**Cause:** pandas 2.2 changed `groupby().apply()` behavior — the grouped key column is no longer included in the group DataFrame passed to the function. Accessing `grp['city']` inside `city_profile()` raised `KeyError`.

**Fix:** Rewrote city profile computation using explicit `groupby().agg()` calls — one per metric group — and merged results on `city` at the end. Completely avoids the `apply()` pattern.

---

### Issue 5 — `season_enc` all-NaN wipes all rows in `dropna()`

**Cause:** The `season_enc` column is built from the `season` column. If `season` does not exist in the master cleaned file, `season_enc` is created as all-NaN. Running `dropna(subset=ALL_FEATURES)` then drops every row.

**Fix:** Added pre-dropna audit that checks each feature for all-NaN and removes it from `ALL_FEATURES` before `dropna()` runs. Also added early `ValueError` with clear message if 0 rows remain after dropna.

---

### Issue 6 — Waterfall chart showing only "Raw" bar

**Cause:** The chart filtered to only steps where `rows_removed > 0`. Since this dataset had 0 rows dropped (KNN-imputed, no duplicates), only the Raw bar appeared.

**Fix:** Waterfall chart now shows all steps. Grey bars = no rows dropped (in-place fix). Red bars = rows actually removed. Added explanation that 0 rows dropped is correct and expected for this file.

---

### Issue 7 — `to_parquet()` ImportError

**Cause:** `pyarrow` not installed in the project venv.

**Fix:** Wrapped `to_parquet()` in `try/except ImportError`. CSV is always saved regardless. Parquet save is attempted first and skipped gracefully with an install instruction if pyarrow is absent.

---

## 9. Quick Reference

### Which notebook to open for which task

| You want to... | Open this notebook |
|---|---|
| Understand the raw data before touching it | `vayu_step1_setup.ipynb` |
| Clean the data and produce the master file | `vayu_step2_cleaning.ipynb` |
| Prepare data for Linear/Multiple Regression | `vayu_step3_regression.ipynb` |
| Prepare data for Logistic Reg / KNN / SVM / Trees / RF | `vayu_step4_classification.ipynb` |
| Prepare data for K-Means clustering of cities | `vayu_step5_clustering.ipynb` |
| Prepare data for PCA / t-SNE / SVD | `vayu_step6_dimensionality.ipynb` |

### Which file to load for which model

| Model | Train file | Test file |
|---|---|---|
| Linear Regression | `01_regression/regression_train.csv` | `01_regression/regression_test.csv` |
| Multiple Regression | same | same |
| Logistic Regression | `02_classification/clf_train_scaled.csv` | `02_classification/clf_test_scaled.csv` |
| KNN | `02_classification/clf_train_scaled.csv` | `02_classification/clf_test_scaled.csv` |
| SVM | `02_classification/clf_train_scaled.csv` | `02_classification/clf_test_scaled.csv` |
| Decision Trees | `02_classification/clf_train_unscaled.csv` | `02_classification/clf_test_unscaled.csv` |
| Random Forest | `02_classification/clf_train_unscaled.csv` | `02_classification/clf_test_unscaled.csv` |
| K-Means | `03_clustering/city_profiles_scaled.csv` | N/A (unsupervised) |
| PCA | `04_dimensionality/pollutant_matrix_scaled.csv` | N/A |
| t-SNE | `04_dimensionality/pollutant_matrix_scaled.csv` | N/A (sample internally) |
| SVD | `04_dimensionality/pollutant_matrix_scaled.csv` | N/A |

### Scaling reference

| Model | Needs Scaling? | Why |
|---|---|---|
| Linear Regression | No (log transform instead) | OLS is scale-invariant |
| Logistic Regression | Yes | Gradient descent |
| KNN | Yes | Euclidean distance |
| SVM | Yes | Kernel distance |
| Decision Tree | No | Threshold-based splits |
| Random Forest | No | Ensemble of trees |
| K-Means | Yes | Euclidean distance |
| PCA | Yes | Variance-based |
| t-SNE | Yes | Distance-based |
| SVD | Optional | Works on raw or scaled |
