import { useState } from 'react';
import { useProfileStore } from '@/store/profileStore';

export function ProfilesSection() {
  const activeId = useProfileStore((s) => s.activeId);
  const activeName = useProfileStore((s) => s.activeName);
  const createAccount = useProfileStore((s) => s.createAccount);
  const login = useProfileStore((s) => s.login);
  const logout = useProfileStore((s) => s.logout);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: 'create' | 'login') {
    setBusy(true);
    setError('');
    try {
      if (action === 'create') await createAccount(name, password);
      else await login(name, password);
      setName('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5">
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/40">Profiles</p>
      {activeId ? (
        <div className="space-y-2 rounded-2xl border border-white/10 p-3 text-sm text-white/70" data-profile-status="in">
          <p>Signed in as {activeName}</p>
          <p className="text-xs leading-relaxed text-white/45">
            Private apps added from + stay on this profile, with their saved credentials.
          </p>
          <button type="button" className="hud-btn-ghost w-full" disabled={busy} onClick={() => void logout()}>
            Log out
          </button>
        </div>
      ) : (
        <form
          className="space-y-2 rounded-2xl border border-white/10 p-3"
          data-profile-status="out"
          onSubmit={(event) => {
            event.preventDefault();
            void run('login');
          }}
        >
          <input
            className="hud-input w-full"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Profile name"
            autoComplete="username"
            aria-label="Profile name"
          />
          <input
            className="hud-input w-full"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            aria-label="Profile password"
          />
          {error ? <p className="text-xs text-rose-200">{error}</p> : null}
          <button type="submit" className="hud-btn-primary w-full" disabled={busy}>
            Log in
          </button>
          <button type="button" className="hud-btn-ghost w-full" disabled={busy} onClick={() => void run('create')}>
            Create profile
          </button>
        </form>
      )}
    </div>
  );
}
