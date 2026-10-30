import { useMemo, useState } from 'react';
import type { JobProgress, Settings } from '../api';
import { planJob } from '../lib/planner';
import type { RarityResolver } from '../lib/rarity';
import { ItemIcon } from './ItemIcon';
import type { GameData, Job } from '../lib/types';
import { levelToXp, MAX_LEVEL, xpRatio } from '../lib/xp';

interface Props {
  job: Job;
  data: GameData;
  rarity: RarityResolver;
  settings: Settings;
  progress: JobProgress;
  onChange: (p: JobProgress) => void;
}

const HARVEST_JOBS = new Set([2, 24, 28, 36, 26]);
const STEPS = [1, 5, 10, 20];
const fmt = (n: number) => n.toLocaleString('fr-FR');
const clampLevel = (v: string) => Math.min(MAX_LEVEL, Math.max(1, Math.round(Number(v)) || 1));

export function JobPanel({ job, data, rarity, settings, progress, onChange }: Props) {
  const [tab, setTab] = useState<'plan' | 'courses'>('plan');
  const target = progress.target ?? MAX_LEVEL;
  const excluded = useMemo(() => new Set(progress.excluded), [progress.excluded]);

  const plan = useMemo(
    () =>
      planJob(job.id, data, rarity, {
        from: progress.level,
        to: target,
        step: progress.step,
        maxRarity: settings.maxRarity,
        excluded,
        bonus: settings.bonus,
        craftSubs: settings.craftSubs,
      }),
    [job.id, data, rarity, progress.level, target, progress.step, settings, excluded],
  );

  const set = (patch: Partial<JobProgress>) => onChange({ ...progress, ...patch });
  const exclude = (recipeId: number) => set({ excluded: [...progress.excluded, recipeId] });
  const restore = (recipeId: number) => set({ excluded: progress.excluded.filter((x) => x !== recipeId) });

  const shopping = [...plan.ingredients.entries()].sort((a, b) => {
    const ra = rarity.ofItem(a[0]).rarity;
    const rb = rarity.ofItem(b[0]).rarity;
    return rb - ra || b[1] - a[1];
  });
  const xpNeeded = levelToXp(target) - levelToXp(progress.level);

  return (
    <section className="panel">
      <div className="panel-head">
        <img className="job-icon" src={`/img/jobs/${job.id}.png`} alt="" />
        <div>
          <h2>{job.name}</h2>
          <p className="muted">
            {fmt(data.recipes.filter((r) => r.jobId === job.id).length)} recettes · {fmt(Math.max(0, xpNeeded))} XP à gagner
          </p>
        </div>
      </div>

      <div className="controls">
        <label>
          Niveau actuel
          <input type="number" min={1} max={MAX_LEVEL} value={progress.level} onChange={(e) => set({ level: clampLevel(e.target.value) })} />
        </label>
        <label>
          Niveau visé
          <span className="target-input">
            <input
              type="number"
              min={1}
              max={MAX_LEVEL}
              disabled={progress.target === null}
              value={target}
              onChange={(e) => set({ target: clampLevel(e.target.value) })}
            />
            <label className="check">
              <input type="checkbox" checked={progress.target === null} onChange={(e) => set({ target: e.target.checked ? null : Math.min(MAX_LEVEL, progress.level + 10) })} />
              Aucun (200)
            </label>
          </span>
        </label>
        <label title="Ne change de recette qu'à chaque palier : moins optimal, mais moins de recettes différentes à préparer.">
          Changer de recette
          <select value={progress.step} onChange={(e) => set({ step: Number(e.target.value) })}>
            {STEPS.map((s) => (
              <option key={s} value={s}>
                {s === 1 ? 'Dès que c’est rentable' : `Tous les ${s} niveaux`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="stats">
        <div>
          <strong>{fmt(plan.totalCrafts)}</strong>
          <span>crafts au total</span>
        </div>
        <div>
          <strong>{new Set(plan.segments.map((s) => s.recipe.id)).size}</strong>
          <span>recettes différentes</span>
        </div>
        <div>
          <strong>
            {progress.level} → {plan.reachedLevel}
          </strong>
          <span>niveaux</span>
        </div>
      </div>

      {plan.blockedAt !== null && (
        <div className="warning">
          Aucune recette éligible ne donne d'XP au niveau {plan.blockedAt}. Élargis le filtre d'ingrédients ou réintègre des recettes exclues.
        </div>
      )}
      {HARVEST_JOBS.has(job.id) && (
        <div className="note">Métier de récolte : ce plan ne compte que les crafts, la récolte rapporte aussi de l'XP.</div>
      )}

      {progress.level >= target ? (
        <div className="empty">Objectif atteint. Augmente le niveau visé pour voir la suite.</div>
      ) : (
        <>
          <div className="tabs small">
            <button className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}>
              Plan de craft
            </button>
            <button className={tab === 'courses' ? 'active' : ''} onClick={() => setTab('courses')}>
              Liste de courses ({shopping.length})
            </button>
          </div>

          {tab === 'plan' ? (
            <ol className="segments">
              {plan.segments.map((s, i) => {
                const item = data.items[s.recipe.resultId];
                const ratio = xpRatio(s.recipe, data);
                return (
                  <li key={`${s.recipe.id}-${i}`} className="segment">
                    <div className="seg-levels">
                      <span>{s.fromLevel}</span>
                      <i />
                      <span>{s.toLevel}</span>
                    </div>
                    <div className="seg-main">
                      <div className="seg-title">
                        <ItemIcon data={data} rarity={rarity} id={s.recipe.resultId} />
                        <div>
                          <div className="seg-name">{item?.name}</div>
                          <div className="muted small">
                            Niv. {s.recipe.level} · {data.types[s.recipe.typeId]?.name}
                            {ratio !== 1 && ` · XP ×${ratio}`} · {fmt(s.firstUnitXp)} XP/exemplaire au départ
                          </div>
                        </div>
                      </div>
                      <div className="seg-ingredients">
                        {s.recipe.ingredients.map(([id, q]) => (
                          <ItemIcon key={id} data={data} rarity={rarity} id={id} qty={q} />
                        ))}
                      </div>
                      {s.subCrafts.size > 0 && (
                        <div className="seg-subs">
                          <span className="muted small">À fabriquer avant :</span>
                          {[...s.subCrafts].map(([rid, n]) => {
                            const sub = data.recipes.find((r) => r.id === rid)!;
                            return (
                              <span key={rid} className="seg-sub">
                                <ItemIcon data={data} rarity={rarity} id={sub.resultId} />
                                <span>
                                  <strong>×{fmt(n)}</strong> {data.items[sub.resultId]?.name}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="seg-count">
                      <strong>×{fmt(s.units)}</strong>
                      {s.crafts !== s.units && <span className="muted small">{fmt(s.crafts)} crafts en tout</span>}
                      <button className="ghost small" onClick={() => exclude(s.recipe.id)} title="Je ne veux pas faire cette recette">
                        Exclure
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="shopping">
              {shopping.map(([id, qty]) => {
                const r = rarity.ofItem(id);
                return (
                  <div key={id} className="shop-row">
                    <ItemIcon data={data} rarity={rarity} id={id} />
                    <span className="shop-name">{data.items[id]?.name}</span>
                    <span className={`tag r${r.rarity}`}>{r.reason}</span>
                    <strong>{fmt(qty)}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {progress.excluded.length > 0 && (
        <details className="excluded">
          <summary>{progress.excluded.length} recette(s) exclue(s)</summary>
          <ul>
            {progress.excluded.map((rid) => {
              const recipe = data.recipes.find((r) => r.id === rid);
              return (
                <li key={rid}>
                  {recipe ? `${data.items[recipe.resultId]?.name} (niv. ${recipe.level})` : `#${rid}`}
                  <button className="ghost small" onClick={() => restore(rid)}>
                    Réintégrer
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}
