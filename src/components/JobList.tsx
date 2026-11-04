import { useMemo, useState } from 'react';
import type { JobProgress, JobSort, Settings } from '../api';
import { DEFAULT_PROGRESS } from '../App';
import { planJob } from '../lib/planner';
import type { RarityResolver } from '../lib/rarity';
import type { GameData } from '../lib/types';
import { MAX_LEVEL } from '../lib/xp';

interface Props {
  data: GameData;
  rarity: RarityResolver;
  settings: Settings;
  progress: Record<string, JobProgress>;
  selected: number;
  onSelect: (id: number) => void;
  onSettingsChange: (s: Settings) => void;
}

const SORT_LABEL: Record<JobSort, string> = {
  default: 'Récolte puis craft',
  alpha: 'Alphabétique',
  level: 'Niveau (plus haut d’abord)',
};

export function JobList({ data, rarity, settings, progress, selected, onSelect, onSettingsChange }: Props) {
  const [managing, setManaging] = useState(false);
  const hidden = useMemo(() => new Set(settings.hidden), [settings.hidden]);

  const summaries = useMemo(
    () =>
      data.jobs.map((job) => {
        const p = progress[job.id] ?? DEFAULT_PROGRESS;
        const target = p.target ?? MAX_LEVEL;
        const plan = planJob(job.id, data, rarity, {
          from: p.level,
          to: target,
          step: p.step,
          maxRarity: settings.maxRarity,
          excluded: new Set(p.excluded),
          bonus: settings.bonus,
          craftSubs: settings.craftSubs,
        });
        return { job, p, target, plan };
      }),
    [data, rarity, settings.maxRarity, settings.bonus, settings.craftSubs, progress],
  );

  const sorted = useMemo(() => {
    const byName = (a: (typeof summaries)[number], b: (typeof summaries)[number]) => a.job.name.localeCompare(b.job.name, 'fr');
    if (settings.sort === 'alpha') return [...summaries].sort(byName);
    if (settings.sort === 'level') return [...summaries].sort((a, b) => b.p.level - a.p.level || byName(a, b));
    return summaries;
  }, [summaries, settings.sort]);

  const visible = managing ? sorted : sorted.filter((s) => !hidden.has(s.job.id));

  const toggleHidden = (jobId: number) => {
    const next = hidden.has(jobId) ? settings.hidden.filter((id) => id !== jobId) : [...settings.hidden, jobId];
    // On garde toujours au moins un métier visible.
    if (next.length >= data.jobs.length) return;
    onSettingsChange({ ...settings, hidden: next });
  };

  return (
    <nav className="job-list">
      <div className="job-list-tools">
        <select
          className="br-input br-input--sm"
          aria-label="Trier les métiers"
          value={settings.sort}
          onChange={(e) => onSettingsChange({ ...settings, sort: e.target.value as JobSort })}
        >
          {(Object.keys(SORT_LABEL) as JobSort[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </select>
        <button className="br-btn br-btn--ghost br-btn--sm" aria-pressed={managing} onClick={() => setManaging((m) => !m)}>
          {managing ? 'Terminé' : hidden.size > 0 ? `Cachés (${hidden.size})` : 'Cacher…'}
        </button>
      </div>
      {managing && <p className="muted small manage-hint">Clique sur l’œil pour cacher ou réafficher un métier.</p>}

      {visible.map(({ job, p, target, plan }) => {
        const done = p.level >= target;
        const isHidden = hidden.has(job.id);
        return (
          <div key={job.id} className={`job-row ${isHidden ? 'is-hidden' : ''}`}>
            <button
              className={`job-card ${job.id === selected && !isHidden ? 'selected' : ''}`}
              onClick={() => (isHidden ? toggleHidden(job.id) : onSelect(job.id))}
            >
              <img src={`/img/jobs/${job.id}.png`} alt="" />
              <div className="job-card-body">
                <div className="job-card-title">
                  <span>{job.name}</span>
                  <span className="lvl">
                    {p.level}
                    <span className="muted"> / {target}</span>
                  </span>
                </div>
                <div className="bar">
                  <div style={{ width: `${(p.level / MAX_LEVEL) * 100}%` }} />
                  {target < MAX_LEVEL && <i style={{ left: `${(target / MAX_LEVEL) * 100}%` }} />}
                </div>
                <div className="job-card-meta">
                  {isHidden
                    ? 'Caché'
                    : done
                      ? 'Objectif atteint'
                      : plan.blockedAt
                        ? `Bloqué au niv. ${plan.blockedAt}`
                        : `${plan.totalCrafts.toLocaleString('fr-FR')} crafts`}
                </div>
              </div>
            </button>
            {managing && (
              <button
                className="eye"
                onClick={() => toggleHidden(job.id)}
                title={isHidden ? 'Réafficher ce métier' : 'Cacher ce métier'}
                aria-label={isHidden ? `Réafficher ${job.name}` : `Cacher ${job.name}`}
                aria-pressed={isHidden}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                  {isHidden && <path d="M3 3l18 18" />}
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
