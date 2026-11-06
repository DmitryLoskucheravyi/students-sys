import { useState } from 'react';
import { api } from '../api.js';
import { Button, Input, PasswordInput } from '../ui.jsx';
import { ThemeButton } from '../session.jsx';

/* Літачок із зошитового аркуша: робить петлю й лишає пунктир, як дорога в роадмапі */
const FLIGHT = 'M40 372C170 384 250 300 300 232C352 160 462 118 470 190C476 248 378 250 386 184C394 112 480 72 556 62';
const LIFT_OFF = '1.75s';
const FLIGHT_TIME = '2.3s';
const FLIGHT_EASE = '0.45 0 0.2 1';

function PaperPlane() {
  const [still] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const plane = (
    <>
      <path d="M24 0L-20 -17L-9 0L-20 17Z" fill="#fff" />
      <path d="M24 0L-9 0L-14 17Z" fill="#ffc9cf" />
    </>
  );
  return (
    <svg className="plane" viewBox="0 0 600 400" preserveAspectRatio="xMaxYMin meet" aria-hidden="true">
      <defs>
        <mask id="flight-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="400">
          <path d={FLIGHT} pathLength="1" fill="none" stroke="#fff" strokeWidth="14" strokeDasharray="1" strokeDashoffset={still ? 0 : 1}>
            {!still && (
              <animate attributeName="stroke-dashoffset" from="1" to="0" begin={LIFT_OFF} dur={FLIGHT_TIME} fill="freeze"
                calcMode="spline" keyTimes="0;1" keySplines={FLIGHT_EASE} />
            )}
          </path>
        </mask>
      </defs>
      <path className="plane-trail" d={FLIGHT} mask="url(#flight-reveal)" />
      {still ? (
        <g transform="translate(556 62) rotate(-8)">{plane}</g>
      ) : (
        <g visibility="hidden">
          <set attributeName="visibility" to="visible" begin={LIFT_OFF} fill="freeze" />
          {plane}
          <animateMotion path={FLIGHT} rotate="auto" begin={LIFT_OFF} dur={FLIGHT_TIME} fill="freeze"
            calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines={FLIGHT_EASE} />
        </g>
      )}
    </svg>
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
        <PaperPlane />
        <p className="bs-logo" role="img" aria-label="Be Smart School">
          <span className="bs-word" aria-hidden="true"><b>B</b><span className="bs-tail"><span>e</span></span></span>
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
