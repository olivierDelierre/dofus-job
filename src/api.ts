import type { Rarity } from './lib/types';

export interface Settings {
  maxRarity: Rarity;
  bonus: number;
}

export interface User {
  id: number;
  username: string;
  settings: Settings;
}

export interface JobProgress {
  level: number;
  /** null = pas d'objectif (niveau 200). */
  target: number | null;
  step: number;
  excluded: number[];
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Erreur ${res.status}`), { status: res.status });
  return data as T;
}

export const api = {
  me: () => call<User>('GET', '/api/me'),
  login: (username: string, password: string) => call<User>('POST', '/api/login', { username, password }),
  register: (username: string, password: string) => call<User>('POST', '/api/register', { username, password }),
  logout: () => call('POST', '/api/logout'),
  progress: () => call<Record<string, JobProgress>>('GET', '/api/progress'),
  saveProgress: (jobId: number, p: JobProgress) => call('PUT', `/api/progress/${jobId}`, p),
  saveSettings: (s: Settings) => call<Settings>('PUT', '/api/settings', s),
};
