import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../api';
import { useTheme, type Theme } from '../lib/theme';
import { Tabs } from './Tabs';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
}

const THEMES: [Theme, string][] = [
  ['auto', 'Auto'],
  ['light', 'Clair'],
  ['dark', 'Sombre'],
];

export function SettingsMenu({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
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
      <button className="icon-btn settings-btn" aria-label="Paramètres" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path
            fill="currentColor"
            d="M19.14 12.94a7.07 7.07 0 0 0 .06-.94c0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54a7.4 7.4 0 0 0-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.36 1.04.67 1.62.94l.36 2.54c.05.24.26.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54a7.4 7.4 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"
          />
        </svg>
      </button>

      {open && (
        <div className="settings-pop br-glass" role="dialog" aria-label="Paramètres">
          <div className="br-field">
            <span className="br-field__label">Thème</span>
            <Tabs label="Thème" value={theme} onChange={setTheme} items={THEMES.map(([value, label]) => ({ value, label }))} />
          </div>

          <label className="br-field">
            <span className="br-field__label">Ingrédients autorisés</span>
            <select
              className="br-input"
              value={settings.maxRarity}
              onChange={(e) =>
                onChange({
                  ...settings,
                  maxRarity: Number(e.target.value) as 0 | 1 | 2,
                })
              }
            >
              <option value={0}>Communs uniquement</option>
              <option value={1}>Communs et peu communs</option>
              <option value={2}>Tous, rares compris</option>
            </select>
            <span className="br-field__hint">Rare : boss à faible drop, archimonstre, boutique à jetons.</span>
          </label>

          <label className="br-check">
            <input type="checkbox" checked={settings.craftSubs} onChange={(e) => onChange({ ...settings, craftSubs: e.target.checked })} />
            <span>
              <span className="br-field__label">Crafter les intermédiaires</span>
              <span className="br-field__hint" style={{ display: 'block' }}>
                Planches, etc. : comptés en XP et en crafts.
              </span>
            </span>
          </label>

          <label className="br-field">
            <span className="br-field__label">Bonus XP (Almanax, événement)</span>
            <span className="suffix-input">
              <input
                className="br-input"
                type="number"
                min={0}
                max={500}
                step={25}
                value={settings.bonus}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    bonus: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
              %
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
