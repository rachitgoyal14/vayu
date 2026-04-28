# Notebook 04 — SHAP Attribution & NMF Source Analysis

Adds two interpretability layers on top of the trained XGBoost forecasters.

## Full Pipeline

```mermaid
flowchart TD
    MODELS_IN["models/\nxgb_6h.pkl · xgb_12h.pkl · xgb_24h.pkl"]
    DATA_IN["data/cleaned/00_shared/master_cleaned.csv"]

    subgraph S0["Section 0 — Config"]
        LOAD_FEAT["Load FEATURES from features.pkl\nmust match regression notebook exactly"]
        HORIZONS["HORIZONS map\n6h · 12h · 24h → model file + target"]
        POLL_COLS["POLLUTANT_COLS subset\npm2.5 · pm10 · co · no2 · so2 · o3"]
    end

    subgraph S1["Section 1 — Reconstruct Dataset"]
        SORT["Sort by city + datetime"]
        ENCODE["LabelEncode city"]
        MAKE_LAGS["Create lag features\nper city group"]
        MAKE_TARGETS["Create forecast targets\nshift(-6) · shift(-12) · shift(-24)"]
        DROPNA["dropna() — same as training"]
        CHRONO_SPLIT["Chronological 80/20 split\nX_train · X_test · meta_test"]
    end

    subgraph PART_A["Part A — SHAP Attribution"]
        direction TB
        TREE_EXP["shap.TreeExplainer(model)\nfor each of 3 horizons"]
        SHAP_VALS["shap_values\nshape: n_test × n_features"]
        AGG["groupby city\nmean |SHAP| per city × feature"]
        POLL_FILTER["Filter to POLLUTANT_COLS only\nisolate env signal from time/lag features"]
        CITY_PROF["City-level attribution profiles\nwhich pollutant drives AQI per city"]
        SHAP_CSV["shap_city_profiles_6h.csv\nshap_city_profiles_12h.csv\nshap_city_profiles_24h.csv"]
        SHAP_PKL["shap_explainer_6h.pkl\nshap_explainer_12h.pkl\nshap_explainer_24h.pkl"]
    end

    subgraph PART_B["Part B — NMF Source Analysis"]
        direction TB
        MINMAX["MinMaxScaler\nnormalise pollutant matrix V (N×6)"]
        NMF_FIT["NMF decomposition\nV ≈ W × H"]
        H_MAT["H matrix (K × 6)\nchemical fingerprint per source"]
        W_MAT["W matrix (N × K)\nper-observation source weights"]
        CITY_MEAN["city mean(W)\nper-city source profile"]
        NMF_CSV["nmf_city_source_profiles.csv"]
        NMF_PKL["nmf_model.pkl\nnmf_scaler.pkl"]
    end

    subgraph PART_C["Part C — Real-Time Inference"]
        INFER["explain_city_reading()\nentry-point for Streamlit dashboard"]
        DOM_POLL["Dominant pollutant\nfrom SHAP waterfall"]
        SOURCE_ATTR["Source attribution\nfrom NMF W vector"]
    end

    DATA_IN & MODELS_IN --> S0
    S0 --> S1
    SORT --> ENCODE --> MAKE_LAGS --> MAKE_TARGETS --> DROPNA --> CHRONO_SPLIT
    CHRONO_SPLIT --> PART_A
    CHRONO_SPLIT --> PART_B
    TREE_EXP --> SHAP_VALS --> AGG --> POLL_FILTER --> CITY_PROF
    CITY_PROF --> SHAP_CSV
    CITY_PROF --> SHAP_PKL
    MINMAX --> NMF_FIT
    NMF_FIT --> H_MAT & W_MAT
    W_MAT --> CITY_MEAN --> NMF_CSV
    NMF_FIT --> NMF_PKL
    SHAP_PKL & NMF_PKL --> PART_C
    INFER --> DOM_POLL & SOURCE_ATTR
```

## Part A — SHAP Value Computation

```mermaid
sequenceDiagram
    participant XGB as XGBoost model
    participant EXP as TreeExplainer
    participant X as X_test (n × 14)
    participant SV as shap_values (n × 14)
    participant AGG as Aggregator
    participant CSV as city_profiles CSV

    loop for each horizon (6h, 12h, 24h)
        EXP->>XGB: wrap model
        EXP->>X: compute exact Shapley values
        X-->>SV: contribution per sample per feature
        SV->>AGG: groupby city → mean(|SHAP|)
        AGG->>AGG: filter to 6 pollutant columns only
        AGG->>CSV: write city × pollutant attribution matrix
        EXP-->>EXP: save explainer.pkl for live dashboard use
    end

    Note over EXP,SV: Fallback: if TreeExplainer fails,<br/>use XGBoost built-in importance (approximation)
```

## Part B — NMF Matrix Factorisation

```mermaid
flowchart LR
    V["V\nN × 6\nobservations × pollutants"]

    NMF_BOX["NMF\nK components"]

    W["W\nN × K\nper-observation\nsource weights"]

    H["H\nK × 6\nsource chemical\nfingerprints"]

    CITY_AGG["mean(W)\ngroupby city"]

    PROFILE["City source profiles\nTraffic · Industrial\nPhotochemical · Biomass…"]

    V --> NMF_BOX
    NMF_BOX --> W & H
    W --> CITY_AGG --> PROFILE
    H --> PROFILE
```

## Expected SHAP Findings by Geography

```mermaid
flowchart TD
    subgraph NORTH["Northern Cities\nDelhi · Gurugram · Lucknow"]
        N1["PM2.5 dominant\nhigh traffic + biomass burning"]
    end
    subgraph SOUTH["Southern Cities\nChennai · Bengaluru · Visakhapatnam"]
        S1["O3 potentially more relevant\nphotochemical conditions"]
    end
    subgraph INDUSTRIAL["Industrial Cities"]
        I1["SO2 + NO2 elevated\nfactory emissions signature"]
    end
```

## Output Artefacts & Consumers

```mermaid
flowchart LR
    subgraph OUTPUTS["Saved Outputs"]
        C1["shap_city_profiles_6h.csv"]
        C2["shap_city_profiles_12h.csv"]
        C3["shap_city_profiles_24h.csv"]
        C4["nmf_city_source_profiles.csv"]
        P1["shap_explainer_6h.pkl"]
        P2["shap_explainer_12h.pkl"]
        P3["shap_explainer_24h.pkl"]
        P4["nmf_model.pkl"]
        P5["nmf_scaler.pkl"]
    end

    subgraph CONSUMERS["Used by"]
        DASH_PRIME["Dashboard\nPrime pollutant card\n(per horizon tab)"]
        DASH_SOURCE["Dashboard\nSource attribution chart"]
        LIVE_SHAP["Live single-prediction\nSHAP waterfall"]
        LIVE_NMF["Live NMF source split\nfor new reading"]
    end

    C1 & C2 & C3 --> DASH_PRIME
    C4 --> DASH_SOURCE
    P1 & P2 & P3 --> LIVE_SHAP
    P4 & P5 --> LIVE_NMF
```
