import { useMemo, useState } from 'react';
import type { JobProgress, Settings } from '../api';
import { planJob } from '../lib/planner';
import { RARITY_TONE, type RarityResolver } from '../lib/rarity';
import { ItemIcon } from './ItemIcon';
import { Tabs } from './Tabs';
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

      <div className="br-card">
        <div className="controls">
          <label className="br-field">
            <span className="br-field__label">Niveau actuel</span>
            <input
              className="br-input"
              type="number"
              min={1}
              max={MAX_LEVEL}
              value={progress.level}
              onChange={(e) => set({ level: clampLevel(e.target.value) })}
            />
          </label>
          <div className="br-field">
            <span className="br-field__label">Niveau visé</span>
            <span className="target-input">
              <input
                className="br-input"
                aria-label="Niveau visé"
                type="number"
                min={1}
                max={MAX_LEVEL}
                disabled={progress.target === null}
                value={target}
                onChange={(e) => set({ target: clampLevel(e.target.value) })}
              />
              <label className="br-check">
                <input
                  type="checkbox"
                  checked={progress.target === null}
                  onChange={(e) =>
                    set({
                      target: e.target.checked ? null : Math.min(MAX_LEVEL, progress.level + 10),
                    })
                  }
                />
                Aucun (200)
              </label>
            </span>
          </div>
          <label className="br-field">
            <span className="br-field__label">Changer de recette</span>
            <select className="br-input" value={progress.step} onChange={(e) => set({ step: Number(e.target.value) })}>
              {STEPS.map((s) => (
                <option key={s} value={s}>
                  {s === 1 ? 'Dès que c’est rentable' : `Tous les ${s} niveaux`}
                </option>
              ))}
            </select>
            <span className="br-field__hint">Par palier : un peu plus de crafts, moins de recettes différentes.</span>
          </label>
        </div>

        <div className="stats">
          <div className="stat">
            <strong>{fmt(plan.totalCrafts)}</strong>
            <span>crafts au total</span>
          </div>
          <div className="stat">
            <strong>{new Set(plan.segments.map((s) => s.recipe.id)).size}</strong>
            <span>recettes différentes</span>
          </div>
          <div className="stat">
            <strong>
              {progress.level} → {plan.reachedLevel}
            </strong>
            <span>niveaux</span>
          </div>
        </div>

        <div className="callouts">
          {plan.blockedAt !== null && (
            <div className="callout callout--danger" role="alert">
              <strong>Bloqué</strong>
              <span>
                Aucune recette éligible ne donne d'XP au niveau {plan.blockedAt}. Élargis le filtre d'ingrédients ou réintègre des recettes exclues.
              </span>
            </div>
          )}
          {HARVEST_JOBS.has(job.id) && (
            <div className="callout callout--brand">
              <strong>Récolte</strong>
              <span>Ce plan ne compte que les crafts, la récolte rapporte aussi de l'XP.</span>
            </div>
          )}
        </div>
      </div>

      <div className="br-card">
        {progress.level >= target ? (
          <div className="empty">Objectif atteint.</div>
        ) : (
          <>
            <div className="plan-head">
              <Tabs
                label="Vue du plan"
                value={tab}
                onChange={setTab}
                items={[
                  { value: 'plan', label: 'Plan de craft' },
                  { value: 'courses', label: `Liste de courses (${shopping.length})` },
                ]}
              />
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
                        <button
                          className="br-btn br-btn--ghost br-btn--sm"
                          onClick={() => exclude(s.recipe.id)}
                          title="Je ne veux pas faire cette recette"
                        >
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
                      <span className={`br-badge br-badge--${RARITY_TONE[r.rarity]}`}>{r.reason}</span>
                      <strong>{fmt(qty)}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {progress.excluded.length > 0 && (
        <details className="excluded br-card">
          <summary>{progress.excluded.length} recette(s) exclue(s)</summary>
          <ul>
            {progress.excluded.map((rid) => {
              const recipe = data.recipes.find((r) => r.id === rid);
              return (
                <li key={rid}>
                  {recipe ? `${data.items[recipe.resultId]?.name} (niv. ${recipe.level})` : `#${rid}`}
                  <button className="br-btn br-btn--ghost br-btn--sm" onClick={() => restore(rid)}>
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
