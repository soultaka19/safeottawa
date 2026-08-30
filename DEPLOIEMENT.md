# Déploiement de SafeOttawa

Application Next.js **entièrement sur Vercel**, base **Neon**. C'est le seul
projet du portfolio sans empreinte sur le VPS.

## Pourquoi Neon et pas le PostgreSQL du socle

La règle du portfolio est « ce qui écrit reste sur le VPS ». SafeOttawa y déroge,
pour une raison mesurable : **le PostgreSQL du socle écoute sur `127.0.0.1`
uniquement** — propriété vérifiée depuis Ottawa, ports 5432 et 6379 fermés.
Vercel ne peut donc pas l'atteindre, et l'ouvrir au réseau public détruirait
cette garantie pour les six autres projets.

SafeOttawa est par ailleurs un Next.js **monolithique** : une seule de ses routes
écrit. Découper l'application pour déplacer un CRUD de deux points d'entrée sur
le VPS coûterait un service, un conteneur et un sous-domaine de plus.

Le projet Neon est en **`aws-us-east-1`**, choisi pour être colocalisé avec les
fonctions Vercel, qui s'exécutent en `iad1` (Washington). L'aller-retour
fonction ↔ base reste ainsi interne à la région.

⚠️ La base gratuite se met en veille après inactivité : le premier signalement
qui suit une période creuse paie un réveil d'environ 500 ms.

## ⚠️ `DATABASE_URL` doit être posée à la main sur Vercel

Le connecteur Vercel **ne sait pas poser de variable d'environnement**. La chaîne
de connexion Neon doit être saisie au tableau de bord du projet
(Settings → Environment Variables), pour les trois environnements.

## Ce que la migration de la persistance corrige

`app/api/reports/route.ts` écrivait dans `data/reports.json` avec
`fs.writeFileSync`. Sur Vercel, le système de fichiers d'une fonction est **en
lecture seule sauf `/tmp`** : l'écriture levait `EROFS`, l'exception n'était pas
attrapée, la réponse était **500**. Même dans `/tmp`, la donnée aurait été propre
à une instance et perdue au démarrage à froid suivant.

Les quatre signalements de démonstration ont été **migrés** dans la table.

Le contrat rendu au client est **inchangé** : `{ id, lat, lon, type, description,
timestamp }`. La colonne s'appelle `created_at` en base et est convertie en
`timestamp` à la sortie, pour ne rien casser côté carte.

## Validation des entrées

L'API acceptait n'importe quoi : `{"lat":"abc","injected":{...},"id":"x"}` était
persisté tel quel, et un corps JSON malformé rendait **500** avec une page vide.

Désormais : bornes géographiques vérifiées, `type` obligatoire (80 caractères),
`description` plafonnée à 500, **tout champ non attendu est écarté**, et un JSON
malformé rend **400** avec sa raison. Les contraintes `CHECK` de la table
doublent ces règles côté base — mais une violation SQL rendrait 500, d'où la
validation applicative en amont.

Le client testait `res.ok` ni en lecture ni en écriture : une erreur d'API
produisait un message trompeur, ou un plantage sur `res.json()`. Corrigé, et le
message d'erreur de l'API est maintenant affiché tel quel.

## Deux autres correctifs

**OSRM passait en `http://`** (`lib/routing.ts`). Cet appel part du **navigateur** :
sur une page servie en HTTPS, il aurait été **bloqué comme contenu mixte** — le
calcul d'itinéraire, cœur de l'application, n'aurait jamais fonctionné en ligne.
Passé en `https://`.

**`next/font/google` retiré** de `app/layout.tsx`. Ces polices n'étaient pas
utilisées — `globals.css` force `Arial` sur `html, body` — mais leur import
ajoutait une dépendance réseau au moment du build. `<html lang>` passe par
ailleurs de `en` à `fr`, l'interface étant en français.

## Ce qui reste en dehors

`/api/geocode` proxifie **Nominatim** et `/api/suggest` lit un JSON local : ni
l'un ni l'autre n'écrit, ils restent des fonctions Vercel. Les tuiles de carte et
les icônes Leaflet viennent d'OpenStreetMap, d'unpkg et de raw.githubusercontent.
