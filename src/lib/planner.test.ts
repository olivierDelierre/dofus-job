import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planJob } from './planner';
import { createRarityResolver } from './rarity';
import type { GameData } from './types';
import { craftXp, levelToXp, xpToLevel } from './xp';

const data: GameData = JSON.parse(readFileSync(new URL('../../public/data/game.json', import.meta.url), 'utf8'));
const rarity = createRarityResolver(data);
const base = { step: 1, maxRarity: 1 as const, excluded: new Set<number>(), bonus: 0 };
const name = (id: number) => data.items[id].name;

describe('xp', () => {
  it('suit la table officielle', () => {
    expect(levelToXp(200)).toBe(398000);
    expect(levelToXp(100)).toBe(99000);
    expect(xpToLevel(398000)).toBe(200);
    expect(xpToLevel(397999)).toBe(199);
  });

  it("un équipement de son niveau donne un niveau entier", () => {
    const hat = data.recipes.find(
      (r) => r.jobId === 27 && r.level === 100 && data.types[r.typeId].craftXpRatio === -1 && data.items[r.resultId].craftXpRatio === -1,
    )!;
    expect(craftXp(hat, 100, data)).toBe(2000);
    expect(craftXp(hat, 99, data)).toBe(0);
  });
});

describe('planner', () => {
  it('Tailleur 1 → 200 en environ un craft par niveau', () => {
    const plan = planJob(27, data, rarity, { ...base, from: 1, to: 200 });
    expect(plan.reachedLevel).toBe(200);
    expect(plan.totalCrafts).toBeLessThan(320);
  });

  it("le Chasseur n'utilise jamais les préparations Fortifiantes", () => {
    const plan = planJob(41, data, rarity, { ...base, from: 1, to: 200 });
    const used = plan.segments.map((s) => name(s.recipe.resultId));
    expect(used.some((n) => /Fortifian/.test(n))).toBe(false);
    expect(plan.reachedLevel).toBe(200);
  });
});
