import { useState } from 'react';
import { api } from '../api.js';
import { ThemeButton, useAuth } from '../session.jsx';
import { Button, PageHead, PasswordInput, useAction } from '../ui.jsx';
import { IconLogout } from '../icons.jsx';

export default function Profile() {
  const { user, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [run, busy] = useAction();

  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(() => api('/auth/password', { method: 'POST', body: { current, next } }), 'Пароль змінено');
    if (ok) {
      setCurrent('');
      setNext('');
    }
  };

  return (
    <>
      <PageHead title={user.name} />
      <p className="muted small">Логін: {user.login}{user.phone ? `, ${user.phone}` : ''}</p>
      <form className="form profile-form" onSubmit={submit}>
        <h2>Зміна пароля</h2>
        <PasswordInput label="Поточний пароль" value={current} onChange={setCurrent} autoComplete="current-password" required />
        <PasswordInput label="Новий пароль" hint="Мінімум 8 символів" value={next} onChange={setNext} autoComplete="new-password" minLength={8} required />
        <div className="form-actions start">
          <Button type="submit" busy={busy}>Змінити пароль</Button>
        </div>
      </form>
      <div className="profile-tools only-mobile">
        <ThemeButton className="on-page" />
        <Button variant="ghost" icon={<IconLogout size={18} />} onClick={logout}>Вийти</Button>
      </div>
    </>
  );
}
