import os, glob
import pandas as pd
import numpy as np

DATA_ROOT = './data'
PRIMARY_FILE = 'aqi_india_38cols_knn_final.csv'
BULLETIN_PATTERN = 'AQIBulletins'
PRIMARY_REQUIRED = ['pm2', 'pm10', 'no2', 'so2', 'co', 'o3']
BULLETIN_KEYWORDS = ['index', 'air', 'quality', 'pollutant']

results = []
all_files = (glob.glob(os.path.join(DATA_ROOT, '**/*.csv'), recursive=True) +
             glob.glob(os.path.join(DATA_ROOT, '**/*.xlsx'), recursive=True))

print(f"Total files found: {len(all_files)}\n")

for fp in sorted(all_files):
    fname = os.path.basename(fp)
    rel   = os.path.relpath(fp, DATA_ROOT)

    if PRIMARY_FILE in fname:
        results.append({'file': rel, 'status': 'ACCEPTED', 'reason': 'Primary dataset'})
        continue
    if BULLETIN_PATTERN in fname:
        results.append({'file': rel, 'status': 'ACCEPTED', 'reason': 'AQI Bulletin'})
        continue

    try:
        df = pd.read_excel(fp, nrows=200) if fname.endswith('.xlsx') else \
             pd.read_csv(fp, nrows=200, low_memory=False, encoding_errors='replace')

        col_str  = ' '.join(c.lower() for c in df.columns)
        null_pct = df.isnull().mean().mean() * 100
        reasons  = []

        if len(df) < 10:                                          reasons.append(f'only {len(df)} rows')
        if len(df.columns) < 3:                                   reasons.append(f'only {len(df.columns)} columns')
        if null_pct > 80:                                         reasons.append(f'{null_pct:.0f}% cells empty')
        if not any(k in col_str for k in PRIMARY_REQUIRED) and \
           not any(k in col_str for k in BULLETIN_KEYWORDS):      reasons.append('no pollutant or AQI columns')
        if not any(k in col_str for k in ['date','time','city']): reasons.append('no date or city column')
        if any(k in col_str for k in PRIMARY_REQUIRED) and len(df) < 100000:
                                                                  reasons.append(f'has pollutants but only {len(df)} rows — likely a sample/subset')
        if not reasons:                                           reasons.append('schema does not match any expected format')

        results.append({
            'file': rel, 'status': 'REJECTED',
            'reason': ' | '.join(reasons),
            'rows': len(df), 'cols': len(df.columns),
            'null_pct': f'{null_pct:.1f}%',
            'columns_preview': str(list(df.columns[:5]))
        })

    except Exception as e:
        results.append({'file': rel, 'status': 'REJECTED',
                        'reason': f'unreadable: {str(e)[:100]}', 'rows': 'ERR'})

rejected = [r for r in results if r['status'] == 'REJECTED']
accepted = [r for r in results if r['status'] == 'ACCEPTED']

print(f"ACCEPTED : {len(accepted)}  |  REJECTED : {len(rejected)}\n")
print("=" * 70)
print("REJECTED FILES")
print("=" * 70)
for r in rejected:
    print(f"\nFile    : {r['file']}")
    print(f"Reason  : {r['reason']}")
    print(f"Shape   : {r.get('rows','?')} rows x {r.get('cols','?')} cols")
    print(f"Columns : {r.get('columns_preview','?')}")

pd.DataFrame(results).to_csv('file_audit.csv', index=False)
print("\n\nAudit saved to: file_audit.csv")
