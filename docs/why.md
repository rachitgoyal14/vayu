## Why the primary file was chosen

When you scan 299 files, most of them fail at least one of these four requirements simultaneously:

**Requirement 1 — All 6 pollutants present.** The CPCB AQI formula takes the maximum sub-index across PM2.5, PM10, NO2, SO2, CO, and O3. If even one pollutant column is missing, you cannot compute AQI from first principles. Most of the other files only had 2-3 pollutants, or had a final AQI number but no individual readings.

**Requirement 2 — Enough rows for temporal learning.** A model needs to see enough examples of winter pollution, monsoon pollution, rush-hour spikes, and post-Diwali events to learn those patterns. 200-row API snapshots cannot teach a model anything about seasonality. 842,160 rows covering 3+ years can.

**Requirement 3 — Multiple cities.** If your dataset only covers Delhi, your model learns Delhi's pollution patterns and generalises poorly to Chennai or Aizawl. 29 cities gives geographic diversity — industrial cities, coastal cities, northeastern cities all behave differently.

**Requirement 4 — Consistent schema.** Some files had the right columns but different naming conventions across years, or merged/split station data. This file has one clean schema across all 29 cities and all years.

The primary file is the only one in all 299 that passes all four simultaneously.

---

## Why the bulletin files were chosen for clustering specifically

The bulletin files only have one number per city per day — the final AQI. No individual pollutants. This makes them useless for regression and classification because:

- Regression needs input features (the 6 pollutants) to predict from. If you only have the output (AQI), there's nothing to train on.
- Classification needs the same input features to learn which pollutant combinations produce which category.

But for clustering the logic flips. You're not predicting anything — you're asking "which cities are similar to each other based on their long-term pollution behaviour?" For that question, daily AQI history is exactly what you need. And 277 cities gives you enough geographic spread to find meaningful geographic clusters — northern plains cities, southern coastal cities, industrial cities, hill stations. The 29-city primary file is too sparse for that.

---

## How the model choices were decided

This is the most important part to understand. The model choices came directly from the nature of the target variable and the structure of the data. It wasn't arbitrary — each model type was forced by what you were trying to predict.

**Look at what you have as output:**

The `aqi_category` column contains text labels — Good, Moderate, Poor etc. That is a categorical output. Predicting a category from features is by definition a classification problem. So Logistic Regression, KNN, SVM, Decision Trees, Random Forest all naturally apply.

There is no pre-computed numeric AQI column in the file. But you can compute one from the 6 pollutants using the CPCB formula. A numeric continuous output (0-500) that you predict from numeric inputs is by definition a regression problem. So Linear Regression, Multiple Regression apply.

The bulletin files have no output column at all — just city-level statistics. When you have no label and want to find natural groupings, that is by definition unsupervised clustering. So K-Means applies.

**The syllabus then confirmed which specific algorithms:**

Your course covers Linear Regression in Lectures 8-17, Classification in Lectures 18-24, K-Means in Lectures 55-56. The folder structure in Step 1 mapped each folder directly to lecture numbers — `01_regression` references Lectures 8-17, `02_classification` references Lectures 18-24 and 56-60, `03_clustering` references Lectures 55-56.

So the decision chain was:

```
What is the output variable?
    ↓
Continuous number  → Regression  → Linear/Multiple Regression
Categorical label  → Classification → LogReg, KNN, SVM, Trees, RF  
No label at all    → Clustering  → K-Means
```

The data told you what kind of problem you had. The problem type told you which algorithm family to use. The syllabus told you which specific algorithms within that family to implement.