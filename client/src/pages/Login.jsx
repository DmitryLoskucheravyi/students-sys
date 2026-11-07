import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Input, PasswordInput } from '../ui.jsx';
import { ThemeButton } from '../session.jsx';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/*
 * Цифрова книга: вилітає знизу зліва, у центрі розгортається й гортає сторінки,
 * згортається, робить оберт і вилітає за правий верхній край. Один раз за відкриття сторінки.
 * Уся хореографія в CSS (.book-*): тут лише будова книги.
 */
function FlyingBook() {
  const lines = (n, cls) => Array.from({ length: n }, (_, i) => <i key={i} className={cls?.[i] ?? ''} />);
  return (
    <div className="book-fly" aria-hidden="true">
      <div className="book-spin">
        <div className="book">
          <div className="book-half book-left">
            <div className="book-face book-inside">{lines(6, ['is-short', '', 'is-code', '', 'is-short', 'is-code'])}</div>
            <div className="book-face book-cover"><b>&lt;/&gt;</b><span /></div>
          </div>
          <div className="book-half book-right">
            <div className="book-face book-inside"><em>01</em>{lines(5, ['', 'is-code', 'is-short', '', 'is-code'])}</div>
            <div className="book-face book-back" />
          </div>
          <div className="book-page book-page-1"><div className="book-face book-inside">{lines(6, ['is-code', '', 'is-short', '', 'is-code', 'is-short'])}</div><div className="book-face book-inside is-back">{lines(5)}</div></div>
          <div className="book-page book-page-2"><div className="book-face book-inside">{lines(6, ['', 'is-short', '', 'is-code', '', ''])}</div><div className="book-face book-inside is-back">{lines(5, ['is-code'])}</div></div>
        </div>
      </div>
    </div>
  );
}

const BITS = ['1 0', '0 1 1 0', '1', '0', '1 0 1', '11 0', '0 1', '1 0 0 1', '0 11'];
const rand = (a, b) => a + Math.random() * (b - a);

/** Двійкові цифри у фоні: зрідка з'являються, пливуть убік і згасають. */
function Bits() {
  const [bits, setBits] = useState([]);
  useEffect(() => {
    if (reducedMotion()) return undefined;
    let n = 0;
    let timer;
    const spawn = () => {
      const id = ++n;
      setBits((list) => [...list.slice(-7), {
        id,
        text: BITS[Math.floor(Math.random() * BITS.length)],
        style: {
          top: `${rand(4, 88)}%`, left: `${rand(4, 82)}%`, fontSize: `${Math.round(rand(13, 22))}px`,
          '--dx': `${(Math.random() < 0.5 ? -1 : 1) * Math.round(rand(40, 110))}px`,
          animationDuration: `${rand(4.5, 7).toFixed(1)}s`,
        },
      }]);
      timer = setTimeout(spawn, rand(900, 2000));
    };
    timer = setTimeout(spawn, 500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="bits" aria-hidden="true">
      {bits.map((b) => (
        <span key={b.id} style={b.style} onAnimationEnd={() => setBits((list) => list.filter((x) => x.id !== b.id))}>{b.text}</span>
      ))}
    </div>
  );
}

export default function Login({ onLogin }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api('/auth/login', { method: 'POST', body: { login, password } }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-art">
        <Bits />
        <FlyingBook />
        <p className="bs-logo" role="img" aria-label="Be Smart School">
          <span className="bs-be" aria-hidden="true">
            <span className="bs-word bs-be-in"><b>B</b><span className="bs-tail"><span>E</span></span></span>
          </span>
          <span className="bs-stack" aria-hidden="true">
            <span className="bs-word"><b>S</b><span className="bs-tail"><span>mart</span></span></span>
            <span className="bs-under"><span>School</span></span>
          </span>
        </p>
      </div>
      <form className="login-form" onSubmit={submit}>
        <ThemeButton className="login-theme" />
        <h1>Вхід</h1>
        <Input label="Логін" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus value={login} onChange={(e) => setLogin(e.target.value)} required />
        <PasswordInput autoComplete="current-password" value={password} onChange={setPassword} required />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" busy={busy} className="btn-wide">Увійти</Button>
        <p className="muted small">Немає акаунта або забули пароль? Зверніться до менеджера.</p>
      </form>
    </div>
  );
}
