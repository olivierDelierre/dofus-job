import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type JobProgress, type Settings, type User } from './api';
import { Login } from './components/Login';
import { JobList } from './components/JobList';
import { JobPanel } from './components/JobPanel';
import { createRarityResolver } from './lib/rarity';
import type { GameData } from './lib/types';

export const DEFAULT_PROGRESS: JobProgress = { level: 1, target: null, step: 1, excluded: [] };

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [data, setData] = useState<GameData | null>(null);
  const [progress, setProgress] = useState<Record<string, JobProgress>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    api.me().then(setUser, () => setUser(null));
    fetch('/data/game.json')
      .then((r) => r.json())
      .then(setData);
  }, []);

  useEffect(() => {
    if (!user) return;
    api.progress().then(setProgress);
  }, [user]);

  useEffect(() => {
    if (data && selected === null) setSelected(data.jobs[0].id);
  }, [data, selected]);

  const rarity = useMemo(() => (data ? createRarityResolver(data) : null), [data]);

  const updateProgress = useCallback((jobId: number, p: JobProgress) => {
    setProgress((prev) => ({ ...prev, [jobId]: p }));
    setSaveState('saving');
    clearTimeout(timers.current.get(jobId));
    timers.current.set(
      jobId,
      setTimeout(() => {
        api.saveProgress(jobId, p).then(
          () => setSaveState('saved'),
          () => setSaveState('error'),
        );
      }, 500),
    );
  }, []);

  const updateSettings = useCallback(
    (s: Settings) => {
      if (!user) return;
      setUser({ ...user, settings: s });
      api.saveSettings(s).catch(() => setSaveState('error'));
    },
    [user],
  );

  if (user === undefined || !data || !rarity) {
    return <div className="splash">Chargement de l'atelier…</div>;
  }
  if (user === null) return <Login onLogged={setUser} />;

  const job = data.jobs.find((j) => j.id === selected) ?? data.jobs[0];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/img/jobs/27.png" alt="" />
          <span>Atelier</span>
          <small>Métiers Dofus 3</small>
        </div>
        <div className="settings">
          <label title="Les ingrédients rares (boss à faible drop, archimonstres, boutiques à jetons…) sont exclus par défaut.">
            Ingrédients
            <select
              value={user.settings.maxRarity}
              onChange={(e) => updateSettings({ ...user.settings, maxRarity: Number(e.target.value) as 0 | 1 | 2 })}
            >
              <option value={0}>Communs uniquement</option>
              <option value={1}>Communs + peu communs</option>
              <option value={2}>Tout, même rares</option>
            </select>
          </label>
          <label title="Bonus Almanax, événement, etc.">
            Bonus XP
            <span className="suffix-input">
              <input
                type="number"
                min={0}
                max={500}
                step={25}
                value={user.settings.bonus}
                onChange={(e) => updateSettings({ ...user.settings, bonus: Math.max(0, Number(e.target.value) || 0) })}
              />
              %
            </span>
          </label>
        </div>
        <div className="account">
          <span className={`save-state ${saveState}`}>
            {saveState === 'saving' ? 'Sauvegarde…' : saveState === 'saved' ? 'Sauvegardé' : saveState === 'error' ? 'Erreur de sauvegarde' : ''}
          </span>
          <span className="username">{user.username}</span>
          <button className="ghost" onClick={() => api.logout().then(() => setUser(null))}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="layout">
        <JobList
          data={data}
          rarity={rarity}
          settings={user.settings}
          progress={progress}
          selected={job.id}
          onSelect={setSelected}
        />
        <JobPanel
          key={job.id}
          job={job}
          data={data}
          rarity={rarity}
          settings={user.settings}
          progress={progress[job.id] ?? DEFAULT_PROGRESS}
          onChange={(p) => updateProgress(job.id, p)}
        />
      </main>
      <footer className="footer">
        Données et icônes : DofusDB / Ankama Games. Fan-site non officiel. Données du {new Date(data.generatedAt).toLocaleDateString('fr-FR')}.
      </footer>
    </div>
  );
}
