"""
VAYU — Column Audit Script
Run this from the folder that contains your /data directory.

Usage:
    python vayu_column_audit.py

Output:
    - Prints a summary to terminal
    - Saves  vayu_column_audit.csv   (one row per file)
    - Saves  vayu_column_freq.csv    (column name frequency across all files)

Install deps if needed:
    pip install pandas openpyxl chardet
"""

import os, glob, warnings, chardet
import pandas as pd
import numpy as np
from pathlib import Path

warnings.filterwarnings("ignore")

# ── CONFIG ─────────────────────────────────────────────────────────────────
DATA_ROOT = "./data"          # ← change if your folder is elsewhere
PEEK_ROWS = 5                 # rows to read per file for type sniffing
# ───────────────────────────────────────────────────────────────────────────


def detect_encoding(fp):
    with open(fp, "rb") as f:
        return chardet.detect(f.read(30_000)).get("encoding", "utf-8") or "utf-8"


def read_file(fp, nrows=PEEK_ROWS):
    ext = Path(fp).suffix.lower()
    try:
        if ext in [".xlsx", ".xls"]:
            xl  = pd.ExcelFile(fp)
            dfs = []
            for sheet in xl.sheet_names:
                try:
                    df = pd.read_excel(fp, sheet_name=sheet, nrows=nrows)
                    if not df.empty:
                        dfs.append((sheet, df))
                except Exception:
                    pass
            # return the sheet with the most columns
            return max(dfs, key=lambda x: x[1].shape[1])[1] if dfs else None

        enc = detect_encoding(fp)
        for sep in [",", ";", "\t", "|"]:
            try:
                df = pd.read_csv(fp, sep=sep, nrows=nrows,
                                 encoding=enc, errors="replace", low_memory=False)
                if df.shape[1] > 1:
                    return df
            except Exception:
                continue
    except Exception:
        pass
    return None


def full_read(fp):
    """Read the whole file (for stats). Returns None on failure."""
    ext = Path(fp).suffix.lower()
    try:
        if ext in [".xlsx", ".xls"]:
            xl  = pd.ExcelFile(fp)
            dfs = []
            for sheet in xl.sheet_names:
                try:
                    df = pd.read_excel(fp, sheet_name=sheet)
                    if not df.empty:
                        dfs.append(df)
                except Exception:
                    pass
            return max(dfs, key=len) if dfs else None

        enc = detect_encoding(fp)
        for sep in [",", ";", "\t", "|"]:
            try:
                df = pd.read_csv(fp, sep=sep, encoding=enc,
                                 errors="replace", low_memory=False)
                if df.shape[1] > 1:
                    return df
            except Exception:
                continue
    except Exception:
        pass
    return None


def sniff_column(series):
    """
    Given a pandas Series, return a human-readable summary:
      dtype | nunique | sample values | missing%
    """
    total    = len(series)
    missing  = series.isna().sum()
    miss_pct = round(missing / total * 100, 1) if total else 0
    non_null = series.dropna()

    if non_null.empty:
        return f"ALL NULL ({miss_pct}% missing)"

    # Try to detect numeric
    numeric = pd.to_numeric(non_null, errors="coerce")
    if numeric.notna().mean() > 0.8:
        mn  = round(numeric.min(), 3)
        mx  = round(numeric.max(), 3)
        avg = round(numeric.mean(), 3)
        return (f"NUMERIC | min={mn} max={mx} mean={avg} "
                f"| {miss_pct}% missing")

    # Try to detect datetime
    try:
        parsed = pd.to_datetime(non_null.astype(str).head(20), errors="coerce", infer_datetime_format=True)
        if parsed.notna().mean() > 0.7:
            sample = str(non_null.iloc[0])[:25]
            return f"DATETIME | sample='{sample}' | {miss_pct}% missing"
    except Exception:
        pass

    # Categorical / text
    nuniq   = non_null.nunique()
    samples = non_null.unique()[:4]
    sample_str = " / ".join(str(s)[:20] for s in samples)
    return (f"TEXT | nunique={nuniq} | samples: {sample_str} "
            f"| {miss_pct}% missing")


def audit_file(fp):
    """Return a dict describing one file."""
    rec = {
        "file"       : os.path.basename(fp),
        "path"       : fp,
        "ext"        : Path(fp).suffix.lower(),
        "size_kb"    : round(os.path.getsize(fp) / 1024, 1),
        "total_rows" : None,
        "total_cols" : None,
        "columns"    : "",
        "error"      : "",
    }

    df = full_read(fp)
    if df is None:
        rec["error"] = "Could not read"
        return rec, {}

    rec["total_rows"] = len(df)
    rec["total_cols"] = len(df.columns)
    rec["columns"]    = " | ".join(df.columns.tolist())

    col_details = {}
    for col in df.columns:
        col_details[col] = sniff_column(df[col])

    return rec, col_details


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

all_files = (
    glob.glob(os.path.join(DATA_ROOT, "**/*.csv"),  recursive=True) +
    glob.glob(os.path.join(DATA_ROOT, "**/*.xlsx"), recursive=True) +
    glob.glob(os.path.join(DATA_ROOT, "**/*.xls"),  recursive=True)
)
all_files = [f for f in all_files if "cleaned" not in f.lower()]

print("=" * 70)
print(f"  VAYU — Column Audit")
print(f"  Scanning: {os.path.abspath(DATA_ROOT)}")
print(f"  Files found: {len(all_files)}")
print("=" * 70)

file_records   = []
all_col_names  = []       # for frequency table
per_file_cols  = []       # flat rows: file × column → description

for i, fp in enumerate(all_files, 1):
    print(f"[{i:>4}/{len(all_files)}] {os.path.basename(fp):<50}", end=" ", flush=True)

    rec, col_details = audit_file(fp)
    file_records.append(rec)

    if rec["error"]:
        print(f"❌  {rec['error']}")
        continue

    print(f"✅  {rec['total_rows']:>7,} rows × {rec['total_cols']:>3} cols")

    # Collect column names for frequency table
    all_col_names.extend([c.strip().lower() for c in col_details.keys()])

    # Flat table: one row per (file, column)
    for col, desc in col_details.items():
        per_file_cols.append({
            "file"       : rec["file"],
            "path"       : fp,
            "column"     : col,
            "description": desc,
        })

# ── Summary ─────────────────────────────────────────────────────────────────
print()
print("=" * 70)
print("  SUMMARY")
print("=" * 70)

file_df = pd.DataFrame(file_records)
ok       = file_df[file_df["error"] == ""]
failed   = file_df[file_df["error"] != ""]

print(f"  Successfully read : {len(ok)} files")
print(f"  Failed            : {len(failed)} files")
if len(ok):
    print(f"  Total rows (all)  : {ok['total_rows'].sum():,}")
    print(f"  Avg cols/file     : {ok['total_cols'].mean():.1f}")

# ── Column frequency table ───────────────────────────────────────────────────
col_freq = (pd.Series(all_col_names)
              .value_counts()
              .reset_index()
              .rename(columns={"index": "column_name", 0: "file_count"}))
col_freq.columns = ["column_name", "file_count"]

print()
print("─" * 70)
print("  TOP 40 COLUMN NAMES (by how many files contain them)")
print("─" * 70)
print(col_freq.head(40).to_string(index=False))

# ── Per-file column detail ───────────────────────────────────────────────────
print()
print("─" * 70)
print("  PER-FILE COLUMN BREAKDOWN (first 10 files)")
print("─" * 70)
col_df = pd.DataFrame(per_file_cols)

for fname, grp in list(col_df.groupby("file"))[:10]:
    print(f"\n  📄 {fname}")
    print(f"  {'COLUMN':<35} DESCRIPTION")
    print(f"  {'──────':<35} ───────────")
    for _, row in grp.iterrows():
        print(f"  {row['column']:<35} {row['description']}")

# ── Save outputs ─────────────────────────────────────────────────────────────
file_df.to_csv("vayu_file_audit.csv", index=False)
col_freq.to_csv("vayu_column_freq.csv", index=False)
col_df.to_csv("vayu_column_detail.csv", index=False)

print()
print("=" * 70)
print("  OUTPUT FILES SAVED")
print("=" * 70)
print("  vayu_file_audit.csv      — one row per file (rows, cols, errors)")
print("  vayu_column_freq.csv     — column name frequency across all files")
print("  vayu_column_detail.csv   — every column in every file with dtype + stats")
print()
print("  → Open vayu_column_freq.csv first to see what columns exist across")
print("    your 800 files and how many files have each one.")
print("=" * 70)