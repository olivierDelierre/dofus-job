// Récupère les données Dofus 3 depuis l'API DofusDB et produit public/data/game.json
// + les icônes (métiers, objets) dans public/img.
// Usage : node scripts/fetch-data.mjs [--no-icons | --icons-only]
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.dofusdb.fr';
const PAGE = 50;

// Métiers qui gagnent de l'XP en fabriquant (les métiers de forgemagie montent via les runes).
const CRAFT_JOBS = [2, 24, 28, 36, 26, 41, 11, 13, 15, 16, 27, 60, 65, 79];

async function get(path, attempt = 0) {
  try {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 4) throw err;
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    return get(path, attempt + 1);
  }
}

async function getAll(path) {
  const sep = path.includes('?') ? '&' : '?';
  const first = await get(`${path}${sep}$limit=${PAGE}&$skip=0`);
  const out = [...first.data];
  const skips = [];
  for (let s = PAGE; s < first.total; s += PAGE) skips.push(s);
  await pool(skips, 6, async (s) => {
    const page = await get(`${path}${sep}$limit=${PAGE}&$skip=${s}`);
    out.push(...page.data);
  });
  return out;
}

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

const fr = (name) => name?.fr ?? name?.en ?? '';

async function main() {
  const withIcons = !process.argv.includes('--no-icons');
  // --icons-only : réutilise public/data/game.json et ne télécharge que les images (build Docker).
  if (process.argv.includes('--icons-only')) {
    const game = JSON.parse(await readFile(join(ROOT, 'public/data/game.json'), 'utf8'));
    await downloadIcons(game);
    console.log('Terminé.');
    return;
  }

  console.log('Métiers…');
  const jobsRaw = (await get('/jobs?$limit=50')).data;
  const jobs = jobsRaw
    .filter((j) => CRAFT_JOBS.includes(j.id))
    .map((j) => ({ id: j.id, name: fr(j.name), iconId: j.iconId }))
    .sort((a, b) => CRAFT_JOBS.indexOf(a.id) - CRAFT_JOBS.indexOf(b.id));

  const items = new Map();
  const keepItem = (it) => {
    if (!it || items.has(it.id)) return;
    items.set(it.id, {
      id: it.id,
      name: fr(it.name),
      level: it.level,
      typeId: it.typeId,
      iconId: it.iconId,
      craftXpRatio: it.craftXpRatio,
      hasRecipe: !!it.hasRecipe,
      harvestable: (it.resourcesBySubarea?.length ?? 0) > 0,
      dropMonsterIds: it.dropMonsterIds ?? [],
      exchangeable: it.exchangeable !== false,
    });
  };

  const types = new Map();
  const recipes = [];
  for (const job of jobs) {
    const list = await getAll(`/recipes?jobId=${job.id}`);
    console.log(`  ${job.name}: ${list.length} recettes`);
    for (const r of list) {
      keepItem(r.result);
      r.ingredients?.forEach(keepItem);
      if (r.resultType) {
        types.set(r.resultType.id, { id: r.resultType.id, name: fr(r.resultType.name), craftXpRatio: r.resultType.craftXpRatio });
      }
      recipes.push({
        id: r.id,
        jobId: r.jobId,
        resultId: r.resultId,
        level: r.resultLevel,
        typeId: r.resultTypeId,
        ingredients: r.ingredientIds.map((id, i) => [id, r.quantities[i]]),
      });
    }
  }

  // Les ingrédients qui sont eux-mêmes craftables : on a besoin de leur recette pour estimer la rareté.
  const missingRecipeIds = new Set();
  for (const it of items.values()) {
    if (it.hasRecipe && !recipes.some((r) => r.resultId === it.id)) missingRecipeIds.add(it.id);
  }
  console.log(`Recettes d'ingrédients hors métiers suivis : ${missingRecipeIds.size}`);
  const subRecipes = [];
  await pool([...missingRecipeIds], 8, async (id) => {
    const res = await get(`/recipes?resultId=${id}&$limit=1`);
    const r = res.data[0];
    if (!r) return;
    r.ingredients?.forEach(keepItem);
    subRecipes.push({ resultId: r.resultId, ingredients: r.ingredientIds.map((x, i) => [x, r.quantities[i]]) });
  });

  console.log('Monstres (drops)…');
  const monsterIds = new Set();
  for (const it of items.values()) it.dropMonsterIds.forEach((m) => monsterIds.add(m));
  const monsters = {};
  await pool([...monsterIds], 8, async (id) => {
    const m = await get(`/monsters/${id}`).catch(() => null);
    if (!m) return;
    monsters[id] = {
      id,
      name: fr(m.name),
      gfxId: m.gfxId,
      boss: !!m.isBoss,
      miniBoss: !!m.isMiniBoss,
      quest: !!m.isQuestMonster,
      level: m.grades?.[0]?.level ?? 0,
      drops: Object.fromEntries((m.drops ?? []).map((d) => [d.objectId, d.percentDropForGrade1])),
    };
  });

  console.log('Boutiques à jetons…');
  const tokenItems = new Set((await getAll('/npc-shop')).map((s) => s.itemId));

  // Meilleur taux de drop "réaliste" par objet : monstres classiques, ni boss ni archimonstre ni quête.
  for (const it of items.values()) {
    let best = 0;
    let common = 0;
    let bossBest = 0;
    for (const mid of it.dropMonsterIds) {
      const m = monsters[mid];
      if (!m || m.miniBoss || m.quest) continue;
      const rate = m.drops[it.id] ?? 0;
      // Boss de donjon : ressource farmable et vendue en HDV, mais moins accessible.
      if (m.boss) {
        bossBest = Math.max(bossBest, rate);
        continue;
      }
      if (rate > 0) common++;
      best = Math.max(best, rate);
    }
    it.bestDrop = best;
    it.commonDroppers = common;
    it.bossDrop = bossBest;
    it.anyDropper = it.dropMonsterIds.length > 0;
    // Monstres qui lâchent l'objet, avec le taux de base (grade 1), du plus généreux au moins généreux.
    it.drops = it.dropMonsterIds
      .map((mid) => [mid, monsters[mid]?.drops[it.id] ?? 0])
      .filter(([mid, rate]) => monsters[mid] && rate > 0)
      .sort((a, b) => b[1] - a[1]);
    it.tokenShop = tokenItems.has(it.id);
    delete it.dropMonsterIds;
  }

  const game = {
    generatedAt: new Date().toISOString(),
    jobs,
    types: Object.fromEntries(types),
    items: Object.fromEntries(items),
    recipes,
    subRecipes,
    monsters: Object.fromEntries(
      [...new Set([...items.values()].flatMap((it) => it.drops.map(([mid]) => mid)))].map((mid) => {
        const { drops, ...m } = monsters[mid];
        return [mid, m];
      }),
    ),
  };
  await mkdir(join(ROOT, 'public/data'), { recursive: true });
  await writeFile(join(ROOT, 'public/data/game.json'), JSON.stringify(game));
  console.log(`public/data/game.json : ${recipes.length} recettes, ${items.size} objets, ${Object.keys(game.monsters).length} monstres`);

  if (withIcons) await downloadIcons(game);
  console.log('Terminé.');
}

/** Télécharge les icônes de métiers, d'objets et de monstres référencés par game.json (déjà présentes = ignorées). */
async function downloadIcons(game) {
  console.log('Icônes…');
  const dl = async (url, file) => {
    try {
      await access(file);
      return;
    } catch {}
    const res = await fetch(url).catch(() => null);
    if (!res?.ok) return;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  };
  await pool(game.jobs, 4, (j) => dl(`${API}/img/jobs/${j.iconId}.png`, join(ROOT, `public/img/jobs/${j.id}.png`)));
  const iconIds = [...new Set(Object.values(game.items).map((i) => i.iconId))];
  let done = 0;
  await pool(iconIds, 16, async (id) => {
    await dl(`${API}/img/items/${id}.png`, join(ROOT, `public/img/items/${id}.png`));
    if (++done % 500 === 0) console.log(`  ${done}/${iconIds.length}`);
  });
  const gfxIds = [...new Set(Object.values(game.monsters).map((m) => m.gfxId))];
  await pool(gfxIds, 16, (id) => dl(`${API}/img/monsters/${id}.png`, join(ROOT, `public/img/monsters/${id}.png`)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
