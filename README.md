# SafeOttawa

**Calculer un itinéraire piéton ou cycliste sur le risque réel d'accident, pas seulement sur la distance.**

Lauréat du défi Sécurité routière, InnovaCode 2026.

**Application en ligne : [safeottawa.soultaka.com](https://safeottawa.soultaka.com)**

---

## Le problème

La Ville d'Ottawa publie ses données de collisions en libre accès. **94 406 incidents** y sont recensés, dont **3 482 impliquant un piéton ou un cycliste**.

Aucune application de navigation n'utilise ces données. Elles vous disent comment aller plus vite ; aucune ne vous dit comment aller plus sûrement.

## Ce que fait l'application

**Une carte de chaleur du danger réel.** Les 94 406 collisions sont agrégées en **1 895 zones à risque**, pondérées par la gravité et la vulnérabilité de l'usager.

**Trois itinéraires comparés, pas un seul.** Pour un même trajet, l'application calcule une route recommandée, une alternative et une route déconseillée, chacune avec son pourcentage de risque. Les trois restent affichées : on ne vous impose pas un choix, on vous montre l'écart.

**Un seuil de tolérance ajustable en temps réel.** Un enfant et un cycliste aguerri n'ont pas la même tolérance au risque. Le curseur réévalue les recommandations sans recalculer les itinéraires, donc sans latence.

**Le signalement de ce que les données ignorent.** Une plaque de verglas, une intersection sans signalisation : les usagers ajoutent sur la carte ce que les statistiques municipales ne connaissent pas encore.

## Comment c'est construit

Le traitement des données est fait en amont, en Python (`scripts/data_prep.py`) : les collisions brutes sont nettoyées, filtrées sur les usagers vulnérables, agrégées spatialement, puis exportées en JSON statique. L'application n'interroge donc jamais un jeu de 94 000 lignes à l'exécution.

Le score de risque d'un itinéraire est calculé en échantillonnant sa géométrie et en mesurant l'exposition de chaque point aux zones à risque environnantes. Le routage s'appuie sur OSRM, le géocodage sur Nominatim, et les signalements communautaires sont stockés en PostgreSQL.

## Pile technique

`Next.js` · `React` · `TypeScript` · `Leaflet` et `leaflet.heat` · `PostgreSQL (Neon)` · `Python` pour la préparation des données · `OSRM` · `Nominatim` · `OpenStreetMap`

## Lancer en local

```bash
npm install
cp .env.example .env.local   # renseigner la chaîne de connexion PostgreSQL
npm run dev
```

L'application démarre sur `http://localhost:3000`.

## Documentation

- **[DOCUMENTATION.md](DOCUMENTATION.md)** : le problème, l'approche, les algorithmes, l'architecture et les limites connues.
- **[DEPLOIEMENT.md](DEPLOIEMENT.md)** : la mise en production.

## Ce que l'application ne fait pas

Les données de collision sont un instantané du jeu publié par la Ville, pas un flux temps réel. Le score de risque est un indicateur relatif entre itinéraires, pas une probabilité d'accident. Les limites sont détaillées dans la documentation, et elles y sont énoncées avant les perspectives.

---

Souleymane Diallo · [soultaka.com](https://soultaka.com) · [linkedin.com/in/souleyman-dev](https://linkedin.com/in/souleyman-dev)
