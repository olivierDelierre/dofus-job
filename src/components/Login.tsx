import { useState, type FormEvent } from 'react';
import { api, type User } from '../api';

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
      <div className="login-card">
        <div className="login-icons">
          {SHOWCASE.map((id) => (
            <img key={id} src={`/img/jobs/${id}.png`} alt="" />
          ))}
        </div>
        <h1>Atelier</h1>

        <div className="tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
            Connexion
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">
            Créer un compte
          </button>
        </div>

        <form onSubmit={submit}>
          <label>
            Pseudo
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={24} />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={busy}>
            {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  );
}
