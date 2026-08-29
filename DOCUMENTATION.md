# SafeOttawa — Documentation du projet
### InnovaCode 2026 · Défi Sécurité Routière

---

## 1. Problème choisi

### Contexte

La Ville d'Ottawa publie ses données de collisions routières (2017–2024) : 94 406 incidents enregistrés sur le réseau municipal. Parmi eux, **3 482 collisions impliquent directement des piétons ou des cyclistes**, soit des usagers qui ne bénéficient d'aucune protection mécanique en cas d'accident. Ces usagers dits *vulnérables* représentent seulement 3,7 % des incidents mais concentrent une part disproportionnée des blessures graves et des décès.

### Problème identifié

Les outils de navigation classiques (Google Maps, Apple Plans) optimisent les trajets pour le temps ou la distance, **sans tenir compte de la dangerosité historique des rues pour les piétons et cyclistes**. Un usager vulnérable n'a aucun moyen de savoir qu'une intersection concentre trois fois plus de collisions que la suivante, ni d'ajuster son trajet en conséquence.

Deux lacunes critiques ressortent :

1. **Absence d'itinéraire sécurisé** : aucun outil ne propose un tracé qui contourne les zones à historique d'accidents élevé pour les usagers vulnérables.
2. **Absence de remontée d'information** : les conditions dangereuses ponctuelles (verglas, nid-de-poule, absence de signalisation) ne sont pas signalées ni partagées en temps réel.

---

## 2. Approche utilisée

### Vue d'ensemble

SafeOttawa combine **deux fonctions complémentaires** :

- Un **navigateur d'itinéraire sécurisé** qui intègre l'historique des collisions dans le calcul du meilleur trajet.
- Un **module de signalement communautaire** qui permet aux usagers de déclarer des dangers ponctuels directement sur la carte.

### Étape 1 — Préparation des données (Python)

Le script `scripts/data_prep.py` traite le fichier `Traffic_Collision_Data.csv` :

1. **Filtrage** : conservation des seules collisions impliquant un piéton ou un cycliste, coordonnées valides dans la bounding box d'Ottawa.
2. **Pondération par gravité** :

   | Classification | Poids |
   |---|---|
   | Collision mortelle | 10 |
   | Blessure non mortelle | 3 |
   | Incident non reportable | 2 |
   | Dommages matériels seuls | 1 |

3. **Agrégation spatiale** : les coordonnées sont arrondies à 3 décimales (~100 m), regroupant les incidents en **1 895 cellules géographiques** couvrant Ottawa.
4. **Normalisation** : chaque cellule reçoit un score de risque normalisé de 0 à 100.
5. **Export** : génération de `public/risk_zones.json` (zones + heatmap) et `public/top_locations.json` (300 intersections les plus dangereuses pour l'autocomplétion).

### Étape 2 — Score de risque d'un itinéraire

Le calcul du risque d'une route est réalisé dans `lib/routing.ts` :

**Index spatial (performance)** : les 1 895 zones sont indexées dans une grille de cellules de ~500 m. Pour chaque point de la route, seules les 9 cellules voisines sont inspectées — la complexité passe de O(1 895) à O(quelques dizaines).

**Formule de score brut** :

```
score_brut = Σ (risk_score_zone × bonus_fatal) / √(distance_km)
```

- `bonus_fatal = 1.5` si la zone contient au moins une collision mortelle, `1.0` sinon.
- La division par √(distance) permet de comparer des itinéraires de longueurs différentes sans pénaliser les trajets longs.
- Chaque zone n'est comptée qu'**une seule fois** même si la route la traverse plusieurs fois.

**Conversion en pourcentage** : le score brut est calibré sur un échantillon de 500 routes aléatoires d'Ottawa.

```
percentile 5  (P5)  = 15,0  → plancher (banlieue calme)
percentile 99 (P99) = 573,9 → plafond  (couloirs les plus dangereux)

risque% = clamp(0, (brut − 15) / 558,9 × 100, 100)
```

Lecture de l'échelle :

| % | Interprétation |
|---|---|
| 0–15 % | Faible — banlieue résidentielle calme |
| 16–40 % | Modéré — artère urbaine standard |
| 41–60 % | Élevé — centre-ville dense |
| 61–80 % | Très élevé — corridors accidentogènes identifiés |
| 81–100 % | Critique — top 1 % des routes les plus dangereuses d'Ottawa |

### Étape 3 — Seuil de tolérance personnalisé

Un **curseur de tolérance** (0–100 %) permet à chaque usager d'ajuster les recommandations selon son profil :

- **🧓 Prudent (15 %)** — enfants, personnes âgées, débutants
- **🚶 Normal (40 %)** — piéton adulte standard
- **🚲 Actif (65 %)** — cycliste expérimenté

L'étiquetage des routes est recalculé **instantanément** (sans appel API) par la fonction `applyTolerance` :

```
score ≤ tolérance           → ✅ Recommandé
score ≤ tolérance + 18 %    → 🔶 Alternatif
score >  tolérance + 18 %   → 🔴 Déconseillé
```

La route la moins risquée est toujours proposée (au minimum en *Alternatif*), même si toutes dépassent le seuil.

### Étape 4 — Routage multi-critères

L'API OSRM renvoie jusqu'à 3 itinéraires alternatifs entre le départ et l'arrivée. Chacun est scoré indépendamment, puis les routes sont triées du moins dangereux au plus dangereux. La meilleure route devient le trajet *Recommandé*, les suivantes sont *Alternatives* ou *Déconseillées*.

### Étape 5 — Signalement communautaire

Un formulaire permet de signaler un danger ponctuel (verglas, chaussée dégradée, intersection dangereuse, etc.) en cliquant directement sur la carte. Les signalements sont persistés côté serveur (JSON) et affichés comme marqueurs orange sur la carte.

---

## 3. Résultats obtenus

### Données traitées

| Indicateur | Valeur |
|---|---|
| Collisions totales dans le jeu de données | 94 406 |
| Collisions impliquant des usagers vulnérables | 3 482 |
| Dont collisions mortelles | 57 |
| Zones de risque identifiées | 1 895 |
| Couverture géographique | Ensemble de la Ville d'Ottawa |
| Période couverte | 2017 – 2024 |

### Fonctionnalités livrées

| Fonctionnalité | Description |
|---|---|
| Heatmap interactive | Visualisation immédiate des 1 895 zones dangereuses dès l'ouverture de l'application |
| Calcul de score de risque | Score 0–100 % calibré sur des données réelles d'Ottawa, affiché par itinéraire |
| Itinéraires sécurisés | Jusqu'à 3 routes classées (recommandée / alternative / déconseillée) pour piéton ou cycliste |
| Autocomplétion intelligente | Recherche instantanée dans les 300 intersections les plus accidentogènes + fallback Nominatim |
| Seuil de tolérance | Curseur temps réel — reclassement instantané des routes sans rappel API |
| Signalement communautaire | Dépôt et visualisation de dangers ponctuels géolocalisés |

### Exemple concret

Un trajet entre le marché By et la rue Bank / Catherine :
- **Route recommandée** : 2,8 km, 36 min, risque **38 %** (modéré) — contourne les zones denses de Rideau
- **Alternative** : 2,3 km, 29 min, risque **61 %** (élevé) — traverse directement le centre-ville
- **Déconseillée** : 2,1 km, 27 min, risque **74 %** (très élevé) — passe par des intersections à historique de collisions mortelles

---

## 4. Technologies utilisées

### Frontend

| Technologie | Rôle |
|---|---|
| **Next.js 16** (App Router, TypeScript) | Framework React avec rendu hybride serveur/client |
| **Tailwind CSS** | Stylisation utilitaire, thème sombre, responsive |
| **React-Leaflet 4** | Carte interactive basée sur Leaflet.js |
| **leaflet.heat** | Couche heatmap canvas pour visualiser les zones de risque |

### APIs et services externes

| Service | Usage | Coût |
|---|---|---|
| **OSRM** (`router.project-osrm.org`) | Calcul d'itinéraires piéton / vélo avec alternatives | Gratuit, sans clé |
| **Nominatim** (OpenStreetMap) | Géocodage d'adresses Ottawa (fallback autocomplétion) | Gratuit, sans clé |

### Backend (Next.js API Routes)

| Route | Fonction |
|---|---|
| `GET /api/suggest` | Autocomplétion : recherche locale d'abord, Nominatim en fallback |
| `GET /api/geocode` | Géocodage d'une adresse libre via Nominatim avec biais Ottawa |
| `GET /api/reports` | Liste des signalements persistés |
| `POST /api/reports` | Enregistrement d'un nouveau signalement |

### Traitement des données

| Technologie | Rôle |
|---|---|
| **Python 3** | Script de préparation des données |
| **pandas** | Filtrage, agrégation et normalisation du CSV |
| **NumPy** | Calculs vectorisés |

### Algorithmes clés

| Algorithme | Implémentation |
|---|---|
| **Index spatial en grille** | `buildSpatialIndex()` — O(1) lookup par cellule de ~500 m |
| **Haversine** | `estimateDistanceKm()` — distance exacte entre coordonnées GPS |
| **Calibration percentile** | P5/P99 sur 500 routes échantillonnées — score 0–100 % interprétable |
| **Debounce** | 280 ms sur l'autocomplétion — limite les requêtes réseau |

---

## 5. Architecture du projet

```
safeottawa/
├── app/
│   ├── page.tsx                  # Interface principale (navigateur + signalement)
│   └── api/
│       ├── geocode/route.ts      # Proxy Nominatim
│       ├── suggest/route.ts      # Autocomplétion hybride
│       └── reports/route.ts      # CRUD signalements
├── components/
│   ├── MapView.tsx               # Carte Leaflet (chargement dynamique, SSR désactivé)
│   ├── AutocompleteInput.tsx     # Champ de recherche avec suggestions
│   └── RiskSlider.tsx            # Curseur de tolérance au risque
├── lib/
│   └── routing.ts                # Moteur de score : index spatial, scoring, classement
├── scripts/
│   └── data_prep.py              # Traitement du CSV → risk_zones.json
└── public/
    ├── risk_zones.json           # 1 895 zones pré-calculées (chargées au démarrage)
    └── top_locations.json        # 300 intersections pour l'autocomplétion locale
```

---

## 6. Limites et perspectives

### Limites actuelles

- **Données 2023 absentes** du jeu de données source.
- **Données statiques** : les zones de risque reflètent 2017–2022/2024 et ne se mettent pas à jour automatiquement lorsque de nouvelles collisions sont enregistrées.
- **Signalements non intégrés au score** : les rapports communautaires sont visualisés sur la carte mais n'influencent pas encore le calcul du risque des itinéraires.

### Perspectives d'amélioration

- **Intégration météo en temps réel** : multiplicateurs de risque selon les conditions (pluie ×1,3, neige ×1,5, verglas ×1,9) via l'API wttr.in — architecture déjà planifiée.
- **Score dynamique** : recalcul automatique du risque à chaque nouvelle entrée dans la base de collisions de la Ville.
- **Pondération par signalement** : intégration des rapports communautaires dans le score de risque local.
- **Accessibilité** : profil *mobilité réduite* avec exclusion des zones sans trottoir ou infrastructure adaptée.
