import { useState } from 'react';
import { api } from '../api.js';
import { ThemeButton, useAuth } from '../session.jsx';
import { Button, PageHead, PasswordInput, useAction } from '../ui.jsx';
import { IconLogout } from '../icons.jsx';
import { Avatar, AvatarPicker } from '../avatars.jsx';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const [runAvatar, savingAvatar] = useAction();
  const pickAvatar = async (avatar) => {
    const r = await runAvatar(() => api('/auth/avatar', { method: 'PATCH', body: { avatar } }), 'Аватарку змінено');
    if (r) setUser((u) => ({ ...u, avatar: r.avatar }));
  };
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
      <div className="profile-head">
        <Avatar user={user} size={64} />
        <div>
          <PageHead title={user.name} />
          <p className="muted small">Логін: {user.login}{user.phone ? `, ${user.phone}` : ''}</p>
        </div>
      </div>
      <section className="profile-form profile-avatar" aria-busy={savingAvatar}>
        <h2>Аватарка</h2>
        <AvatarPicker value={user.avatar} onChange={pickAvatar} name={user.name} />
      </section>
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
