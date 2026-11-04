import { useState, type FormEvent } from 'react';
import { api, type User } from '../api';
import { Tabs } from './Tabs';

const SHOWCASE = [2, 24, 28, 36, 26, 41, 11, 13, 15, 16, 27, 60, 65];

export function Login({ onLogged }: { onLogged: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogged(await (mode === 'login' ? api.login : api.register)(username, password));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card br-card">
        <div className="login-icons">
          {SHOWCASE.map((id) => (
            <img key={id} src={`/img/jobs/${id}.png`} alt="" />
          ))}
        </div>
        <div>
          <h1>Atelier</h1>
          <p className="muted small" style={{ margin: 0 }}>
            Métiers Dofus
          </p>
        </div>

        <Tabs
          label="Connexion ou création de compte"
          value={mode}
          onChange={setMode}
          items={[
            { value: 'login', label: 'Connexion' },
            { value: 'register', label: 'Créer un compte' },
          ]}
        />

        <form onSubmit={submit}>
          <label className="br-field">
            <span className="br-field__label">Pseudo</span>
            <input
              className="br-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={3}
              maxLength={24}
            />
          </label>
          <label className="br-field">
            <span className="br-field__label">Mot de passe</span>
            <input
              className="br-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </label>
          {error && (
            <div className="callout callout--danger form-error" role="alert">
              <strong>Erreur</strong>
              <span>{error}</span>
            </div>
          )}
          <button className="br-btn br-btn--primary" disabled={busy}>
            {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  );
}
