import { useCallback, useState } from 'react';

export type Theme = 'auto' | 'light' | 'dark';

const KEY = 'atelier-theme';

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

/** Thème mémorisé par appareil ; « auto » suit la préférence du système. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(read);
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try {
      if (t === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      /* stockage indisponible : le choix vaut pour cette session */
    }
  }, []);
  return [theme, setTheme];
}
