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
  /**
   * Fabrique soi-même les ingrédients que le même métier sait faire (planches du Bûcheron…) :
   * ces crafts comptent dans l'XP et dans le nombre de crafts.
   */
  craftSubs: boolean;
}

export interface PlanSegment {
  recipe: Recipe;
  fromLevel: number;
  toLevel: number;
  /** Nombre d'exemplaires de la recette principale. */
  units: number;
  /** Crafts au total, intermédiaires compris. */
  crafts: number;
  /** Crafts d'intermédiaires par recette. */
  subCrafts: Map<number, number>;
  xp: number;
  /** XP d'un exemplaire (intermédiaires compris) au début du segment. */
  firstUnitXp: number;
}

export interface Plan {
  segments: PlanSegment[];
  totalCrafts: number;
  reachedLevel: number;
  /** Niveau auquel le plan bloque faute de recette éligible. */
  blockedAt: number | null;
  /** Ressources à se procurer (les intermédiaires fabriqués sont remplacés par leurs propres ingrédients). */
  ingredients: Map<number, number>;
}

/** Ce que coûte et rapporte la fabrication d'un exemplaire, intermédiaires du métier compris. */
interface Unit {
  xp: number;
  crafts: number;
  subCrafts: Map<number, number>;
  raw: Map<number, number>;
}

const addTo = (target: Map<number, number>, source: Map<number, number>, factor: number) => {
  for (const [k, v] of source) target.set(k, (target.get(k) ?? 0) + v * factor);
};

function createUnitBuilder(jobId: number, data: GameData, opts: PlanOptions) {
  // Recette du métier pour chaque objet qu'il sait produire (la moins haut niveau si plusieurs).
  const byResult = new Map<number, Recipe>();
  for (const r of data.recipes) {
    if (r.jobId !== jobId) continue;
    const prev = byResult.get(r.resultId);
    if (!prev || r.level < prev.level) byResult.set(r.resultId, r);
  }
  const cache = new Map<string, Unit>();

  function build(recipe: Recipe, level: number, depth = 0): Unit {
    const key = `${recipe.id}:${level}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const unit: Unit = { xp: craftXp(recipe, level, data, opts.bonus), crafts: 1, subCrafts: new Map(), raw: new Map() };
    for (const [id, q] of recipe.ingredients) {
      const sub = opts.craftSubs && depth < 4 ? byResult.get(id) : undefined;
      // Un intermédiaire au-dessus du niveau du métier ne peut pas être fabriqué : on l'achète.
      if (sub && sub.id !== recipe.id && sub.level <= level) {
        const u = build(sub, level, depth + 1);
        unit.xp += q * u.xp;
        unit.crafts += q * u.crafts;
        unit.subCrafts.set(sub.id, (unit.subCrafts.get(sub.id) ?? 0) + q);
        addTo(unit.subCrafts, u.subCrafts, q);
        addTo(unit.raw, u.raw, q);
      } else {
        unit.raw.set(id, (unit.raw.get(id) ?? 0) + q);
      }
    }
    cache.set(key, unit);
    return unit;
  }

  return build;
}

type UnitBuilder = ReturnType<typeof createUnitBuilder>;

/** Fabrique la recette jusqu'à atteindre `targetXp` en partant de `xp`. */
function simulate(recipe: Recipe, xp: number, targetXp: number, build: UnitBuilder) {
  let units = 0;
  let crafts = 0;
  const subCrafts = new Map<number, number>();
  const raw = new Map<number, number>();
  while (xp < targetXp) {
    const level = xpToLevel(xp);
    if (recipe.level > level) return null;
    const unit = build(recipe, level);
    if (unit.xp <= 0) return null;
    // Le gain ne change qu'au passage de niveau : on avance d'un bloc jusqu'au niveau suivant.
    const nextLevelXp = Math.min(levelToXp(level + 1), targetXp);
    const n = Math.ceil((nextLevelXp - xp) / unit.xp);
    units += n;
    crafts += n * unit.crafts;
    addTo(subCrafts, unit.subCrafts, n);
    addTo(raw, unit.raw, n);
    xp += n * unit.xp;
  }
  return { units, crafts, subCrafts, raw, xp };
}

/** Part minimale de l'XP/craft de la meilleure recette pour garder la recette en cours. */
const STICKINESS = 0.95;

const ingredientCount = (r: Recipe) => r.ingredients.reduce((s, [, q]) => s + q, 0);

export function eligibleRecipes(jobId: number, data: GameData, rarity: RarityResolver, opts: Pick<PlanOptions, 'maxRarity' | 'excluded'>) {
  return data.recipes.filter(
    (r) => r.jobId === jobId && !opts.excluded.has(r.id) && rarity.ofRecipe(r) <= opts.maxRarity,
  );
}

export function planJob(jobId: number, data: GameData, rarity: RarityResolver, opts: PlanOptions): Plan {
  const pool = eligibleRecipes(jobId, data, rarity, opts);
  const build = createUnitBuilder(jobId, data, opts);
  const to = Math.min(MAX_LEVEL, Math.max(opts.to, opts.from));
  const step = Math.max(1, opts.step);
  const segments: PlanSegment[] = [];
  const ingredients = new Map<number, number>();
  let xp = levelToXp(opts.from);
  let level = opts.from;
  let blockedAt: number | null = null;

  while (level < to) {
    const nextLevel = Math.min(to, (Math.floor(level / step) + 1) * step);
    const targetXp = levelToXp(nextLevel);

    // Pré-sélection sur l'XP par craft au niveau courant, puis simulation exacte.
    const candidates = pool
      .filter((r) => r.level <= level)
      .map((r) => ({ r, unit: build(r, level) }))
      .filter((c) => c.unit.xp > 0)
      .sort((a, b) => b.unit.xp / b.unit.crafts - a.unit.xp / a.unit.crafts)
      .slice(0, 12);

    let best: { r: Recipe; sim: NonNullable<ReturnType<typeof simulate>>; unitXp: number } | null = null;
    for (const c of candidates) {
      const sim = simulate(c.r, xp, targetXp, build);
      if (!sim) continue;
      const better =
        !best ||
        sim.crafts < best.sim.crafts ||
        // À nombre de crafts égal : moins d'ingrédients, puis moins rare.
        (sim.crafts === best.sim.crafts &&
          (ingredientCount(c.r) < ingredientCount(best.r) ||
            (ingredientCount(c.r) === ingredientCount(best.r) && rarity.ofRecipe(c.r) < rarity.ofRecipe(best.r))));
      if (better) best = { r: c.r, sim, unitXp: c.unit.xp };
    }

    if (!best) {
      blockedAt = level;
      break;
    }

    // Inertie : on garde la recette en cours si elle est presque aussi bonne, pour éviter d'alterner à chaque niveau.
    const last = segments[segments.length - 1];
    if (last && last.recipe.id !== best.r.id && last.recipe.level <= level) {
      const lastUnit = build(last.recipe, level);
      const bestUnit = build(best.r, level);
      const keep = simulate(last.recipe, xp, targetXp, build);
      if (keep && lastUnit.xp / lastUnit.crafts >= (bestUnit.xp / bestUnit.crafts) * STICKINESS) {
        best = { r: last.recipe, sim: keep, unitXp: lastUnit.xp };
      }
    }

    const { sim } = best;
    if (last && last.recipe.id === best.r.id) {
      last.toLevel = nextLevel;
      last.units += sim.units;
      last.crafts += sim.crafts;
      last.xp += sim.xp - xp;
      addTo(last.subCrafts, sim.subCrafts, 1);
    } else {
      segments.push({
        recipe: best.r,
        fromLevel: level,
        toLevel: nextLevel,
        units: sim.units,
        crafts: sim.crafts,
        subCrafts: sim.subCrafts,
        xp: sim.xp - xp,
        firstUnitXp: best.unitXp,
      });
    }
    addTo(ingredients, sim.raw, 1);
    xp = sim.xp;
    level = xpToLevel(xp);
  }

  return {
    segments,
    totalCrafts: segments.reduce((s, x) => s + x.crafts, 0),
    reachedLevel: level,
    blockedAt,
    ingredients,
  };
}
