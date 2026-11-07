import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Button, Input, PasswordInput } from '../ui.jsx';
import { ThemeButton } from '../session.jsx';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Тривимірна книга (three.js). Модуль сцени вантажиться окремо, тільки тут.
 * Без WebGL книги просто немає: заставка лишається з лого й цифрами.
 */
function Book3D() {
  const ref = useRef(null);
  useEffect(() => {
    const startAt = performance.now();
    let alive = true;
    let stop;
    import('../book3d.js')
      .then(({ mountBook }) => { if (alive && ref.current) stop = mountBook(ref.current, { still: reducedMotion(), startAt }); })
      .catch(() => {});
    return () => { alive = false; stop?.(); };
  }, []);
  return <div ref={ref} className="book3d" aria-hidden="true" />;
}

const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Двійкові цифри у фоні. Кожна цифра окрема: зʼявляється у своєму місці,
 * пливе у свій бік зі своєю швидкістю й згасає.
 */
function Bits() {
  const [bits, setBits] = useState([]);
  useEffect(() => {
    if (reducedMotion()) return undefined;
    let n = 0;
    let timer;
    const spawn = () => {
      const id = ++n;
      // Лише по горизонталі: ліворуч або праворуч
      const dx = (Math.random() < 0.5 ? -1 : 1) * Math.round(rand(50, 160));
      setBits((list) => [...list.slice(-15), {
        id,
        text: Math.random() < 0.5 ? '0' : '1',
        style: {
          top: `${rand(3, 92)}%`, left: `${rand(3, 94)}%`, fontSize: `${Math.round(rand(12, 24))}px`,
          '--dx': `${dx}px`,
          '--peak': rand(0.25, 0.5).toFixed(2),
          animationDuration: `${rand(3.5, 7.5).toFixed(1)}s`,
        },
      }]);
      timer = setTimeout(spawn, rand(350, 900));
    };
    timer = setTimeout(spawn, 400);
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
        <Book3D />
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
