import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { IconMoon, IconSun } from './icons.jsx';

export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

/** Той самий поріг, що й десктопний @media у styles.css. */
const DESKTOP = '(min-width: 900px)';

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => !window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const m = window.matchMedia(DESKTOP);
    const on = () => setMobile(!m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return mobile;
}

export function useTheme() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme);
  const toggle = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('zoshyt-theme', next); } catch { /* сховище недоступне */ }
    setTheme(next);
  }, []);
  return [theme, toggle];
}

export function ThemeButton({ className = '' }) {
  const [theme, toggle] = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Світла тема' : 'Темна тема';
  return (
    <button type="button" className={`theme-btn ${className}`} onClick={toggle} aria-label={label} title={label}>
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  );
}
