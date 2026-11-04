import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type User } from '../api';

/**
 * Écran de connexion posé sur l'app floutée : on choisit son profil dans la liste des comptes,
 * ou on en crée un avec un simple pseudo (pas de mot de passe).
 */
export function Login({ onLogged }: { onLogged: (u: User) => void }) {
  const [users, setUsers] = useState<string[] | null>(null);
  const [name, setName] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  const load = () => api.users().then(setUsers, () => setUsers([])); // sans liste, on propose quand même la création

  useEffect(() => {
    load();
  }, []);

  // Focus sur le premier profil, ou sur le champ de création s'il n'y a pas encore de compte.
  useEffect(() => {
    if (users) card.current?.querySelector<HTMLElement>('.auth-user, .auth-new input')?.focus();
  }, [users]);

  async function enter(kind: 'login' | 'register', username: string) {
    setBusy(true);
    setError('');
    try {
      onLogged(await api[kind](username, remember));
    } catch (err) {
      setError((err as Error).message);
      if ((err as { status?: number }).status === 404) load(); // le profil a disparu : on rafraîchit la liste
    } finally {
      setBusy(false);
    }
  }

  function create(e: FormEvent) {
    e.preventDefault();
    enter('register', name.trim());
  }

  const hasUsers = !!users?.length;

  return (
    <div className="auth" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="auth-card br-glass" ref={card}>
        <h2 id="auth-title">Bienvenue à l'Atelier</h2>
        {hasUsers && (
          <section>
            <p>Qui es-tu ?</p>
            <div className="auth-list" role="list">
              {users.map((u) => (
                <button key={u} type="button" role="listitem" className="auth-user" disabled={busy} onClick={() => enter('login', u)}>
                  <span className="avatar" aria-hidden>
                    {[...u][0].toUpperCase()}
                  </span>
                  <span className="auth-user-name">{u}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        <form onSubmit={create}>
          <p>
            {hasUsers
              ? 'Ou crée un nouveau compte (un pseudo suffit, pas de mot de passe) :'
              : 'Crée ton compte : un pseudo suffit, pas de mot de passe.'}
          </p>
          <div className="auth-new">
            <input
              className="br-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nouveau pseudo"
              aria-label="Nouveau pseudo"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              minLength={3}
              maxLength={24}
            />
            <button className="br-btn br-btn--secondary" disabled={busy}>
              Créer
            </button>
          </div>
        </form>
        <label className="br-check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Se souvenir de moi</span>
        </label>
        {error && (
          <p className="auth-err" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
