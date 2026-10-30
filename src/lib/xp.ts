import type { GameData, Recipe } from './types';

export const MAX_LEVEL = 200;

/** XP totale nécessaire pour atteindre un niveau de métier. */
export const levelToXp = (level: number) => level * (level - 1) * 10;

export const xpToLevel = (xp: number) =>
  Math.max(1, Math.min(MAX_LEVEL, Math.floor((Math.sqrt(1 + 0.4 * xp) + 1) / 2)));

/** Coefficient d'XP propre à l'objet, sinon à son type (en fraction). */
export function xpRatio(recipe: Recipe, data: GameData): number {
  const item = data.items[recipe.resultId];
  if (item && item.craftXpRatio > -1) return item.craftXpRatio / 100;
  const type = data.types[recipe.typeId];
  if (type && type.craftXpRatio > -1) return type.craftXpRatio / 100;
  return 1;
}

/**
 * XP gagnée pour un craft, d'après la formule du jeu :
 * 20 × niv. recette / ((niv. métier − niv. recette)^1.1 / 10 + 1) × coefficient,
 * nulle au-delà de 100 niveaux d'écart. Une recette au-dessus du niveau du métier n'est pas craftable.
 */
export function craftXp(recipe: Recipe, jobLevel: number, data: GameData, bonus = 0): number {
  const gap = jobLevel - recipe.level;
  if (gap < 0 || gap > 100) return 0;
  const base = (20 * recipe.level) / (gap ** 1.1 / 10 + 1);
  return Math.floor(Math.floor(base * xpRatio(recipe, data)) * (1 + bonus / 100));
}
