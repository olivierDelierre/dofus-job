export interface Job {
  id: number;
  name: string;
  iconId: number;
}

export interface Item {
  id: number;
  name: string;
  level: number;
  typeId: number;
  iconId: number;
  craftXpRatio: number;
  hasRecipe: boolean;
  harvestable: boolean;
  exchangeable: boolean;
  bestDrop: number;
  commonDroppers: number;
  bossDrop: number;
  anyDropper: boolean;
  tokenShop: boolean;
  /** [monsterId, taux de drop de base en %], du plus élevé au plus faible. */
  drops: [monsterId: number, rate: number][];
}

export interface Monster {
  id: number;
  name: string;
  gfxId: number;
  level: number;
  boss: boolean;
  miniBoss: boolean;
  quest: boolean;
}

export interface ItemType {
  id: number;
  name: string;
  craftXpRatio: number;
}

export type Ingredient = [itemId: number, quantity: number];

export interface Recipe {
  id: number;
  jobId: number;
  resultId: number;
  level: number;
  typeId: number;
  ingredients: Ingredient[];
}

export interface GameData {
  generatedAt: string;
  jobs: Job[];
  types: Record<string, ItemType>;
  items: Record<string, Item>;
  recipes: Recipe[];
  subRecipes: { resultId: number; ingredients: Ingredient[] }[];
  monsters: Record<string, Monster>;
}

/** 0 = commun, 1 = peu commun, 2 = rare (exclu par défaut). */
export type Rarity = 0 | 1 | 2;
