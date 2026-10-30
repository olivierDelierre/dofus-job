import type { GameData, Item, Rarity, Recipe } from './types';

// Types d'objets coûteux sans source classique (galets de Kolizéum…).
const RARE_TYPES = new Set([152]);

export const RARITY_LABEL: Record<Rarity, string> = { 0: 'Commun', 1: 'Peu commun', 2: 'Rare' };

export interface RarityInfo {
  rarity: Rarity;
  reason: string;
}

/**
 * Estime la difficulté d'obtention d'un ingrédient pour éviter les recettes aberrantes
 * (viandes "Bidoche" des Chasseurs, ressources de boss, galets…).
 */
export function createRarityResolver(data: GameData) {
  const subRecipes = new Map<number, Recipe['ingredients']>();
  for (const r of data.recipes) if (!subRecipes.has(r.resultId)) subRecipes.set(r.resultId, r.ingredients);
  for (const r of data.subRecipes) if (!subRecipes.has(r.resultId)) subRecipes.set(r.resultId, r.ingredients);

  const cache = new Map<number, RarityInfo>();

  function ofItem(id: number, depth = 0): RarityInfo {
    const cached = cache.get(id);
    if (cached) return cached;
    const item: Item | undefined = data.items[id];
    let info: RarityInfo;
    if (!item) info = { rarity: 1, reason: 'Source inconnue' };
    else if (item.harvestable) info = { rarity: 0, reason: 'Récoltable' };
    else if (item.hasRecipe && subRecipes.has(id) && depth < 4) {
      // Pré-calcul pour couper les cycles éventuels.
      cache.set(id, { rarity: 1, reason: 'Craftable' });
      const worst = Math.max(0, ...subRecipes.get(id)!.map(([sub]) => ofItem(sub, depth + 1).rarity)) as Rarity;
      info = { rarity: worst, reason: 'Craftable' };
    } else if (item.tokenShop || RARE_TYPES.has(item.typeId)) info = { rarity: 2, reason: 'Boutique à jetons' };
    else if (item.commonDroppers > 0) {
      const d = item.bestDrop;
      const reason = `Drop ${d}% (${item.commonDroppers} monstre${item.commonDroppers > 1 ? 's' : ''})`;
      info = { rarity: d >= 10 ? 0 : d >= 3 ? 1 : 2, reason };
    } else if (item.bossDrop > 0) {
      info = { rarity: item.bossDrop >= 10 ? 1 : 2, reason: `Boss de donjon (${item.bossDrop}%)` };
    } else if (item.anyDropper) info = { rarity: 2, reason: 'Archimonstre / quête uniquement' };
    else info = { rarity: 1, reason: 'PNJ ou source inconnue' };
    cache.set(id, info);
    return info;
  }

  const recipeCache = new Map<number, Rarity>();
  function ofRecipe(recipe: Recipe): Rarity {
    let r = recipeCache.get(recipe.id);
    if (r === undefined) {
      r = Math.max(0, ...recipe.ingredients.map(([id]) => ofItem(id).rarity)) as Rarity;
      recipeCache.set(recipe.id, r);
    }
    return r;
  }

  return { ofItem: (id: number) => ofItem(id), ofRecipe };
}

export type RarityResolver = ReturnType<typeof createRarityResolver>;
