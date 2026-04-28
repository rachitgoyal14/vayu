# Notebook 03 — AQI Category Classifier Pipeline

Trains a multi-class classifier to predict CPCB AQI category from current pollutant readings.

## Training Pipeline

```mermaid
flowchart TD
    INPUT_TR["clf_train_unscaled.csv\n663K rows"]
    INPUT_TE["clf_test_unscaled.csv\n166K rows"]

    S0["Section 0 — Imports & Config\nCAT_ORDER · CAT_COLORS · paths"]

    subgraph S1["Section 1 — Load & Validate"]
        LOAD["Read unscaled CSVs\ntree models are scale-invariant"]
        VAL["Validate\ntarget column · feature list · NaN check"]
        CLASS_DIST["Plot class distribution\nconfirm 4-class structure"]
    end

    subgraph FEATS["Features used (6)"]
        FT["pm2_5_ugm3 · pm10_ugm3\nco_ugm3 · o3_ugm3\nno2_ugm3 · city_enc"]
    end

    subgraph S2["Section 2 — Random Forest"]
        RF["RandomForestClassifier\n200 trees\nclass_weight=balanced"]
        RF_EVAL["Accuracy: 0.793\nWeighted F1: 0.793\nPoor recall: 66.5%\nModel size: ~3 045 MB ❌"]
    end

    subgraph S3["Section 3 — XGBoost Classifier"]
        XGB_REMAP["Label remap\nremove gaps in integer classes"]
        XGB_SW["Compute sample_weight\nper-class balancing"]
        XGB["XGBClassifier\n300 trees"]
        XGB_EVAL["Accuracy: 0.745\nWeighted F1: 0.748\nPoor recall: 71.1% ✅\nModel size: ~5.4 MB ✅"]
    end

    S4["Section 4 — Compare\nper-class F1 · confusion matrices"]
    S5["Section 5 — Feature Importance\nGini (RF) vs Gain (XGBoost)"]
    S6["Section 6 — Confidence Distribution\nmax predicted probability"]
    S7["Section 7 — Inference Function\npredict_category(pollutants, city)"]
    S8["Section 8 — Save\nbest_classifier.pkl ← XGBoost\nclassifier_metadata.json"]

    INPUT_TR & INPUT_TE --> S0 --> S1
    LOAD --> VAL --> CLASS_DIST
    S1 --> FEATS
    FEATS --> S2
    FEATS --> S3
    XGB_REMAP --> XGB_SW --> XGB --> XGB_EVAL
    S2 --> S4
    S3 --> S4
    S4 --> S5 --> S6 --> S7 --> S8
```

## Class Distribution

```mermaid
pie title AQI Category Distribution (Training Set)
    "Moderate (2)" : 304113
    "Poor (3)" : 138033
    "Very Poor (4)" : 113983
    "Good (0)" : 107564
```

## Model Selection Decision

```mermaid
flowchart LR
    subgraph RF_BOX["Random Forest"]
        RF_ACC["Accuracy: 0.793 ✅"]
        RF_POOR["Poor recall: 66.5% ❌"]
        RF_SIZE["Size: ~3 045 MB ❌\nNot deployable on Render free tier"]
    end

    subgraph XGB_BOX["XGBoost"]
        XGB_ACC["Accuracy: 0.745"]
        XGB_POOR["Poor recall: 71.1% ✅\nClinically critical class"]
        XGB_SIZE["Size: ~5.4 MB ✅\nDeploys on Render free tier"]
    end

    DECISION{"Deploy which?"}
    RF_BOX --> DECISION
    XGB_BOX --> DECISION
    DECISION --> WINNER["XGBoost\nbest_classifier.pkl"]

    note["RF accuracy advantage comes almost entirely\nfrom Moderate (45.8% of data).\nXGBoost wins on Poor — the class that\ntriggers CPCB health advisories."]
```

## Inference Flow (Production)

```mermaid
sequenceDiagram
    participant FE as Frontend / API
    participant CLF as best_classifier.pkl
    participant ENC as city_encoder.pkl
    participant OUT as Response

    FE->>ENC: city name
    ENC-->>FE: city_enc integer
    FE->>CLF: [pm2.5, pm10, co, o3, no2, city_enc]
    CLF-->>FE: class probabilities (4 classes)
    FE->>OUT: predicted category + confidence
```
