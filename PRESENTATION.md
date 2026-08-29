# SafeOttawa — Script de présentation & démo
**InnovaCode 2026 · Durée estimée : 4 minutes**

---

## OUVERTURE (30 sec)

> "Chaque année à Ottawa, des centaines de piétons et cyclistes sont blessés — parfois mortellement — sur des intersections dont le danger est connu et documenté depuis des années.
>
> Google Maps vous dit d'aller plus vite. Nous, on vous dit comment aller plus **sûrement**."

---

## LE PROBLÈME (30 sec)

> "La Ville d'Ottawa publie ses données de collisions. **94 000 incidents** sur 8 ans. Parmi eux, **3 482 impliquent des piétons ou des cyclistes** — des gens sans carrosserie, sans airbag.
>
> Aucun outil de navigation aujourd'hui n'utilise ces données pour recommander un itinéraire. On a changé ça."

---

## LA SOLUTION — DEMO EN DIRECT (2 min)

### Étape 1 — La carte s'ouvre (10 sec)
> "Dès l'ouverture, SafeOttawa affiche une heatmap des **1 895 zones dangereuses** d'Ottawa, calculée à partir des données réelles de collision. Les zones rouges, ce sont les endroits où des piétons et cyclistes ont été blessés — ou tués."

### Étape 2 — Chercher un itinéraire (30 sec)
> "Je tape mon point de départ — *Rideau St @ King Edward Ave* — une des intersections les plus accidentogènes de la ville."

*(Taper dans l'autocomplete, sélectionner la suggestion 📍)*

> "Et mon arrivée — *Bank St @ Catherine St*."

*(Sélectionner la suggestion)*

> "Je clique sur **Trouver itinéraire sécurisé**."

### Étape 3 — Les résultats (40 sec)
> "En quelques secondes, SafeOttawa calcule et compare **trois itinéraires** — pas seulement sur la distance ou le temps, mais sur le **niveau de risque réel** basé sur l'historique des collisions.
>
> Ici : la **route recommandée** en vert — 38 % de risque, elle contourne les zones denses.
> L'**alternative** en orange — plus courte, mais plus exposée.
> La **déconseillée** en rouge — elle passe par les corridors les plus dangereux de la ville.
>
> Sur la carte, la recommandée est tracée en trait épais. Les autres restent visibles pour comparer."

### Étape 4 — Le curseur de tolérance (20 sec)
> "Chaque usager est différent. Un enfant n'a pas la même tolérance au risque qu'un cycliste aguerri.
>
> Ce curseur ajuste les recommandations **en temps réel** — sans aucun recalcul."

*(Faire glisser le curseur de 40 % vers 15 % — Prudent)*

> "À 15 %, même la route recommandée déclenche un avertissement. L'application conseille alors les corridors les plus calmes de la ville."

### Étape 5 — Signalement (20 sec)
> "Et si vous croisez un danger que les données ne connaissent pas encore — une plaque de verglas, une intersection sans signalisation — vous signalez directement sur la carte."

*(Cliquer sur l'onglet Signalement, cliquer sur la carte)*

> "Le signalement est enregistré et visible par tous les usagers instantanément."

---

## SOUS LE CAPOT (30 sec)

> "Techniquement : **Next.js**, **Tailwind**, **React-Leaflet** pour l'interface.
>
> Pour le calcul de risque : un index spatial qui analyse **1 895 zones** en quelques millisecondes. Le score est une moyenne pondérée des zones traversées — les collisions mortelles comptent 1,5× plus. Résultat : un pourcentage de 0 à 100 %, calibré sur les données réelles d'Ottawa.
>
> Zéro API payante. Zéro clé. Tout est open source."

---

## CLÔTURE (20 sec)

> "SafeOttawa ne remplace pas une décision humaine. Mais il donne à chaque piéton, chaque cycliste, chaque parent qui envoie son enfant à l'école — une information qu'il n'avait pas avant.
>
> La sécurité routière commence par la connaissance du danger.
> Nous, on met cette connaissance dans votre poche."

---

## CHECKLIST DÉMO

Avant de commencer :
- [ ] `npm run dev` lancé, page ouverte sur `localhost:3000`
- [ ] Onglet **Navigateur** actif, curseur à **Normal 40 %**
- [ ] Carte centrée sur Ottawa (zoom 13)

Séquence de saisie :
1. Départ → taper `King Edward` → sélectionner **Rideau St @ King Edward Ave** (📍)
2. Arrivée → taper `Bank Cat` → sélectionner **Bank St @ Catherine St** (📍)
3. Cliquer **Trouver itinéraire sécurisé**
4. Montrer les 3 cartes + les 3 tracés sur la carte
5. Glisser curseur → **Prudent 15 %** → montrer le badge ⚠
6. Cliquer onglet **Signalement** → cliquer sur la carte → montrer le formulaire
