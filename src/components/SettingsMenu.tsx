import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../api';

interface Props {
  username: string;
  settings: Settings;
  onChange: (s: Settings) => void;
  onLogout: () => void;
}

export function SettingsMenu({ username, settings, onChange, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="settings-menu" ref={root}>
      <button className="icon-btn" aria-label="Paramètres" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div className="settings-pop" role="dialog" aria-label="Paramètres">
          <div className="settings-pop-head">
            <span className="muted small">Connecté en tant que</span>
            <strong>{username}</strong>
          </div>

          <label className="field">
            Ingrédients autorisés
            <select value={settings.maxRarity} onChange={(e) => onChange({ ...settings, maxRarity: Number(e.target.value) as 0 | 1 | 2 })}>
              <option value={0}>Communs uniquement</option>
              <option value={1}>Communs et peu communs</option>
              <option value={2}>Tous, rares compris</option>
            </select>
            <span className="muted small">Rare : boss à faible drop, archimonstre, boutique à jetons.</span>
          </label>

          <label className="field check">
            <input type="checkbox" checked={settings.craftSubs} onChange={(e) => onChange({ ...settings, craftSubs: e.target.checked })} />
            <span>
              Crafter les intermédiaires
              <span className="muted small"> (planches, etc. : comptés en XP et en crafts)</span>
            </span>
          </label>

          <label className="field">
            Bonus XP (Almanax, événement)
            <span className="suffix-input">
              <input
                type="number"
                min={0}
                max={500}
                step={25}
                value={settings.bonus}
                onChange={(e) => onChange({ ...settings, bonus: Math.max(0, Number(e.target.value) || 0) })}
              />
              %
            </span>
          </label>

          <button className="ghost logout" onClick={onLogout}>
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}
