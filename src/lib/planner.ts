import { craftXp, levelToXp, MAX_LEVEL, xpToLevel } from './xp';
import type { RarityResolver } from './rarity';
import type { GameData, Rarity, Recipe } from './types';

export interface PlanOptions {
  from: number;
  to: number;
  /** On ne change de recette qu'à chaque palier de N niveaux. */
  step: number;
  maxRarity: Rarity;
  excluded: Set<number>;
  /** Bonus d'XP en % (Almanax, événement…). */
  bonus: number;
}

export interface PlanSegment {
  recipe: Recipe;
  fromLevel: number;
  toLevel: number;
  crafts: number;
  xp: number;
  firstCraftXp: number;
}

export interface Plan {
  segments: PlanSegment[];
  totalCrafts: number;
  reachedLevel: number;
  /** Niveau auquel le plan bloque faute de recette éligible. */
  blockedAt: number | null;
  ingredients: Map<number, number>;
}

/** Nombre de crafts pour passer de `xp` à `targetXp` avec une seule recette. */
function simulate(recipe: Recipe, xp: number, targetXp: number, data: GameData, bonus: number) {
  let crafts = 0;
  let level = xpToLevel(xp);
  let gain = craftXp(recipe, level, data, bonus);
  while (xp < targetXp) {
    if (gain <= 0) return null;
    // Avance d'un coup jusqu'au prochain niveau : le gain ne change qu'au passage de niveau.
    const nextLevelXp = Math.min(levelToXp(level + 1), targetXp);
    const n = Math.ceil((nextLevelXp - xp) / gain);
    crafts += n;
    xp += n * gain;
    const newLevel = xpToLevel(xp);
    if (newLevel !== level) {
      level = newLevel;
      gain = craftXp(recipe, level, data, bonus);
    }
  }
  return { crafts, xp };
}

const ingredientCount = (r: Recipe) => r.ingredients.reduce((s, [, q]) => s + q, 0);

export function eligibleRecipes(jobId: number, data: GameData, rarity: RarityResolver, opts: Pick<PlanOptions, 'maxRarity' | 'excluded'>) {
  return data.recipes.filter(
    (r) => r.jobId === jobId && !opts.excluded.has(r.id) && rarity.ofRecipe(r) <= opts.maxRarity,
  );
}

export function planJob(jobId: number, data: GameData, rarity: RarityResolver, opts: PlanOptions): Plan {
  const pool = eligibleRecipes(jobId, data, rarity, opts);
  const to = Math.min(MAX_LEVEL, Math.max(opts.to, opts.from));
  const step = Math.max(1, opts.step);
  const segments: PlanSegment[] = [];
  let xp = levelToXp(opts.from);
  let level = opts.from;
  let blockedAt: number | null = null;

  while (level < to) {
    const nextLevel = Math.min(to, (Math.floor(level / step) + 1) * step);
    const targetXp = levelToXp(nextLevel);

    // Pré-sélection : meilleures recettes au niveau courant, puis simulation exacte.
    const candidates = pool
      .map((r) => ({ r, gain: craftXp(r, level, data, opts.bonus) }))
      .filter((c) => c.gain > 0)
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 12);

    let best: { r: Recipe; crafts: number; xp: number; gain: number } | null = null;
    for (const c of candidates) {
      const sim = simulate(c.r, xp, targetXp, data, opts.bonus);
      if (!sim) continue;
      const better =
        !best ||
        sim.crafts < best.crafts ||
        // À nombre de crafts égal : moins d'ingrédients, puis moins rare.
        (sim.crafts === best.crafts &&
          (ingredientCount(c.r) < ingredientCount(best.r) ||
            (ingredientCount(c.r) === ingredientCount(best.r) && rarity.ofRecipe(c.r) < rarity.ofRecipe(best.r))));
      if (better) best = { r: c.r, crafts: sim.crafts, xp: sim.xp, gain: c.gain };
    }

    if (!best) {
      blockedAt = level;
      break;
    }

    const last = segments[segments.length - 1];
    if (last && last.recipe.id === best.r.id) {
      last.toLevel = nextLevel;
      last.crafts += best.crafts;
      last.xp += best.xp - xp;
    } else {
      segments.push({ recipe: best.r, fromLevel: level, toLevel: nextLevel, crafts: best.crafts, xp: best.xp - xp, firstCraftXp: best.gain });
    }
    xp = best.xp;
    level = xpToLevel(xp);
  }

  const ingredients = new Map<number, number>();
  for (const s of segments) {
    for (const [id, q] of s.recipe.ingredients) ingredients.set(id, (ingredients.get(id) ?? 0) + q * s.crafts);
  }

  return {
    segments,
    totalCrafts: segments.reduce((s, x) => s + x.crafts, 0),
    reachedLevel: level,
    blockedAt,
    ingredients,
  };
}
