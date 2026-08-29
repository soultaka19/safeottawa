"""
data_prep.py
Genere public/risk_zones.json depuis Traffic_Collision_Data.csv
Usage: py scripts/data_prep.py
"""
import pandas as pd
import numpy as np
import json
import os

CSV_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'Traffic_Collision_Data.csv')
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'risk_zones.json')

print("Chargement des donnees...")
df = pd.read_csv(CSV_PATH)
print(f"  {len(df)} lignes chargees")

# 1. Filtrer usagers vulnerables (pieton OU velo)
vuln = df[
    (df['num_of_pedestrians'].notna()) |
    (df['num_of_bicycles'].notna())
].copy()
print(f"  {len(vuln)} collisions impliquant des usagers vulnerables")

# 2. Coordonnees valides (bounding box Ottawa)
vuln = vuln[
    (vuln['Lat'] > 44.9) & (vuln['Lat'] < 45.6) &
    (vuln['Long'] > -76.5) & (vuln['Long'] < -75.0)
]
print(f"  {len(vuln)} avec coordonnees valides")

# 3. Poids par gravite
weights = {
    '01 - Fatal injury':    10,
    '02 - Non-fatal injury': 3,
    '04 - Non-reportable':   2,
    '03 - P.D. only':        1,
}
vuln['weight'] = vuln['Classification_Of_Accident'].map(weights).fillna(1)

# 4. Grille ~100m (arrondi a 3 decimales)
vuln['lat_g'] = vuln['Lat'].round(3)
vuln['lon_g'] = vuln['Long'].round(3)

# 5. Agregation par cellule
risk = vuln.groupby(['lat_g', 'lon_g']).agg(
    risk_score=('weight', 'sum'),
    nb_collisions=('weight', 'count'),
    nb_fatal=('Classification_Of_Accident', lambda x: (x == '01 - Fatal injury').sum()),
    nb_pedestrians=('num_of_pedestrians', 'count'),
    nb_bicycles=('num_of_bicycles', 'count'),
).reset_index().rename(columns={'lat_g': 'lat', 'lon_g': 'lon'})

# 6. Normalisation 0-100
max_score = risk['risk_score'].max()
risk['risk_score'] = (risk['risk_score'] / max_score * 100).round(1)

print(f"\nTop 5 zones dangereuses:")
for _, row in risk.nlargest(5, 'risk_score').iterrows():
    print(f"  lat={row['lat']} lon={row['lon']} score={row['risk_score']} collisions={int(row['nb_collisions'])}")

# 7. Format heatmap Leaflet : [[lat, lon, intensity], ...]
heatmap_data = risk[['lat', 'lon', 'risk_score']].values.tolist()

# 8. Output JSON
output = {
    'zones': risk.to_dict(orient='records'),
    'heatmap': heatmap_data,
    'stats': {
        'total_zones': len(risk),
        'total_collisions_vulnerables': int(vuln.shape[0]),
        'total_fatal': int((vuln['Classification_Of_Accident'] == '01 - Fatal injury').sum()),
        'total_pietons': int(df['num_of_pedestrians'].notna().sum()),
        'total_velos': int(df['num_of_bicycles'].notna().sum()),
    }
}

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, 'w') as f:
    json.dump(output, f)

print(f"\nFichier genere: {OUT_PATH}")
print(f"  {len(risk)} zones | {len(heatmap_data)} points heatmap")
