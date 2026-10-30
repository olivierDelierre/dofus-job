import { useMemo } from 'react';
import type { JobProgress, Settings } from '../api';
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
}

export function JobList({ data, rarity, settings, progress, selected, onSelect }: Props) {
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
        });
        return { job, p, target, plan };
      }),
    [data, rarity, settings, progress],
  );

  return (
    <nav className="job-list">
      {summaries.map(({ job, p, target, plan }) => {
        const done = p.level >= target;
        return (
          <button key={job.id} className={`job-card ${job.id === selected ? 'selected' : ''}`} onClick={() => onSelect(job.id)}>
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
                {done ? 'Objectif atteint' : plan.blockedAt ? `Bloqué au niv. ${plan.blockedAt}` : `${plan.totalCrafts.toLocaleString('fr-FR')} crafts`}
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
