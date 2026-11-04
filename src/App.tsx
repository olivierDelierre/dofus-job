import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type JobProgress, type Settings, type User } from './api';
import { Login } from './components/Login';
import { JobList } from './components/JobList';
import { JobPanel } from './components/JobPanel';
import { SettingsMenu } from './components/SettingsMenu';
import { createRarityResolver } from './lib/rarity';
import type { GameData } from './lib/types';

export const DEFAULT_PROGRESS: JobProgress = {
  level: 1,
  target: null,
  step: 1,
  excluded: [],
};

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [data, setData] = useState<GameData | null>(null);
  const [progress, setProgress] = useState<Record<string, JobProgress>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // Sélectionne le premier métier visible si aucun ne l'est (ou si celui en cours vient d'être caché).
  const hidden = user?.settings.hidden;
  useEffect(() => {
    if (!data) return;
    if (selected !== null && !hidden?.includes(selected)) return;
    const first = data.jobs.find((j) => !hidden?.includes(j.id));
    if (first) setSelected(first.id);
  }, [data, selected, hidden]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

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
    return <div className="splash">Chargement…</div>;
  }
  if (user === null) return <Login onLogged={setUser} />;

  const job = data.jobs.find((j) => j.id === selected) ?? data.jobs[0];

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn menu-btn" aria-label="Liste des métiers" aria-expanded={drawerOpen} onClick={() => setDrawerOpen((o) => !o)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div className="brand">
          <img className="brand-mark" src="/img/jobs/27.png" alt="" />
          <span className="brand-name">Atelier</span>
          <span className="brand-job">{job.name}</span>
        </div>
        {saveState !== 'idle' && (
          <span
            className={`save-state br-badge ${saveState === 'saved' ? 'br-badge--success' : saveState === 'error' ? 'br-badge--danger' : ''}`}
            role="status"
          >
            {saveState === 'saving' ? 'Sauvegarde…' : saveState === 'saved' ? 'Sauvegardé' : 'Erreur de sauvegarde'}
          </span>
        )}
        <SettingsMenu settings={user.settings} onChange={updateSettings} />
        <div className="user">
          <span className="user-avatar" title={user.username} aria-hidden>
            {user.username[0].toUpperCase()}
          </span>
          <span className="user-name">{user.username}</span>
          <button className="icon-btn" aria-label="Déconnexion" title="Déconnexion" onClick={() => api.logout().then(() => setUser(null))}>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </header>

      <main className="layout">
        <div className={`backdrop ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
        <aside className={`sidebar ${drawerOpen ? 'open' : ''}`}>
          <JobList
            data={data}
            rarity={rarity}
            settings={user.settings}
            progress={progress}
            selected={job.id}
            onSelect={(id) => {
              setSelected(id);
              setDrawerOpen(false);
            }}
            onSettingsChange={updateSettings}
          />
        </aside>
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
      <footer className="footer">Données DofusDB du {new Date(data.generatedAt).toLocaleDateString('fr-FR')}</footer>
    </div>
  );
}
