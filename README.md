# Atelier — métiers Dofus 3

Web-app pour planifier la montée des métiers de Dofus 3 au plus petit nombre de crafts, avec comptes utilisateurs et sauvegarde de la progression.

## Lancer

```bash
npm install
npm run fetch-data   # récupère recettes + icônes depuis DofusDB (≈ 1 min, ~100 Mo d'icônes)
npm run dev          # API sur :3001, front sur http://localhost:5173
```

Production : `npm run build && npm start` (sert `dist/` et l'API sur `API_PORT`, 3001 par défaut). La base SQLite est `server/data.db` (`DB_PATH` pour la changer).

## Comment le plan est calculé

- **XP par craft** (formule du jeu) : `20 × niv. recette / ((niv. métier − niv. recette)^1.1 / 10 + 1) × coefficient`, nulle au-delà de 100 niveaux d'écart. Le coefficient vient de l'objet ou de son type (`craftXpRatio`, ex. 10 % pour les viandes).
- **XP par niveau** : `10 × N × (N − 1)` pour atteindre le niveau N (398 000 au niveau 200).
- **Anti-aberrations** : chaque ingrédient reçoit une rareté (récoltable, craftable, taux de drop sur monstres classiques, boss de donjon, archimonstre, boutique à jetons). Une recette prend la rareté de son pire ingrédient ; les recettes « rares » sont exclues par défaut (ex. préparations Fortifiantes du Chasseur, qui demandent des Bidoches). Chaque recette peut aussi être exclue à la main.
- **Optimisation** : à chaque palier (1, 5, 10 ou 20 niveaux), on choisit la recette éligible qui atteint le palier suivant en un minimum de crafts (à égalité : moins d'ingrédients, puis moins rare).

Données et icônes : [DofusDB](https://dofusdb.fr) / Ankama Games. Fan-site non officiel.
