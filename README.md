# Atelier — métiers Dofus

App locale pour suivre nos métiers Dofus : niveau actuel, niveau visé, crafts à faire et ressources nécessaires. Un compte par personne, progression sauvegardée côté serveur.

## Lancer

```bash
npm install
npm run fetch-data   # récupère recettes + icônes depuis DofusDB (≈ 1 min, ~100 Mo d'icônes)
npm run dev          # API sur :3001, front sur http://localhost:5173
```

Production : `npm run build && npm start` (sert `dist/` et l'API sur `API_PORT`, 3001 par défaut). La base SQLite est `server/data.db` (`DB_PATH` pour la changer).

## Docker / TrueNAS

L'image embarque le front compilé, l'API et toutes les icônes (téléchargées depuis DofusDB au build). La base SQLite vit dans le volume `/data`.

**Avec l'image publiée par GitHub** : chaque push sur `main`/`master` lance `.github/workflows/docker.yml`, qui teste puis publie `ghcr.io/olivierdelierre/dofus-job:latest` (amd64 + arm64). Après le premier build, passe le package en public (GitHub → Packages → dofus-job → Package settings → Change visibility), sinon TrueNAS devra s'authentifier sur ghcr.io.

**Sur TrueNAS SCALE** (Apps → Discover Apps → ⋮ → Install via YAML), colle `docker-compose.yml` en supprimant la ligne `build: .` et en pointant le volume vers un dataset :

```yaml
services:
  atelier:
    image: ghcr.io/olivierdelierre/dofus-job:latest
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - /mnt/tank/apps/dofus-atelier:/data
    environment:
      - TZ=Europe/Paris
      # Utilisateur propriétaire des données (568 = « apps » sur TrueNAS SCALE)
      - PUID=568
      - PGID=568
```

Le conteneur démarre en root, donne le dossier `/data` à `PUID:PGID` (1000 par défaut), puis lance l'app sous cet utilisateur : pas besoin de régler les permissions du dataset à la main. L'app répond ensuite sur `http://<ip-du-nas>:3001`. Le cookie de session passe en `Secure` automatiquement derrière un reverse proxy HTTPS (`X-Forwarded-Proto`).

**En local** :

```bash
docker compose up -d --build
```

Pour rafraîchir les données du jeu après une mise à jour de Dofus : `npm run fetch-data`, commit de `public/data/game.json`, push → nouvelle image.

## Comment le plan est calculé

- **XP par craft** (formule du jeu) : `20 × niv. recette / ((niv. métier − niv. recette)^1.1 / 10 + 1) × coefficient`, nulle au-delà de 100 niveaux d'écart. Le coefficient vient de l'objet ou de son type (`craftXpRatio`, ex. 10 % pour les viandes).
- **XP par niveau** : `10 × N × (N − 1)` pour atteindre le niveau N (398 000 au niveau 200).
- **Anti-aberrations** : chaque ingrédient reçoit une rareté (récoltable, craftable, taux de drop sur monstres classiques, boss de donjon, archimonstre, boutique à jetons). Une recette prend la rareté de son pire ingrédient ; les recettes « rares » sont exclues par défaut (ex. préparations Fortifiantes du Chasseur, qui demandent des Bidoches). Chaque recette peut aussi être exclue à la main.
- **Optimisation** : à chaque palier (1, 5, 10 ou 20 niveaux), on choisit la recette éligible qui atteint le palier suivant en un minimum de crafts (à égalité : moins d'ingrédients, puis moins rare).
- **Intermédiaires** : si une recette demande un ingrédient que le même métier fabrique (planches pour les substrats du Bûcheron…), ce craft est compté dans l'XP et dans le nombre de crafts, et la liste de courses descend jusqu'aux ressources brutes. Désactivable (« Crafter les intermédiaires »).
- **Drops** : au survol d'une ressource, la liste des monstres qui la lâchent avec leur taux de base (grade 1), monstres classiques d'abord.

Données et icônes : [DofusDB](https://dofusdb.fr) / Ankama Games. Fan-site non officiel.
