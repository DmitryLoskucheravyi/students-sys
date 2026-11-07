import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/onest';
import './styles.css';
import { api } from './api.js';
import { UIProvider } from './ui.jsx';
import { AuthCtx, ThemeButton, useAuth } from './session.jsx';
import { IconCalendar, IconChart, IconHomework, IconLesson, IconLogout, IconPeople, IconRoadmap, IconTicket } from './icons.jsx';
import { initials } from './fmt.js';
import Login from './pages/Login.jsx';
import Schedule from './pages/Schedule.jsx';
import Lessons from './pages/Lessons.jsx';
import Courses from './pages/Courses.jsx';
import CourseDetail from './pages/CourseDetail.jsx';
import Subscriptions from './pages/Subscriptions.jsx';
import MySubscription from './pages/MySubscription.jsx';
import People from './pages/People.jsx';
import Homework from './pages/Homework.jsx';
import HomeworkDetail from './pages/HomeworkDetail.jsx';
import Profile from './pages/Profile.jsx';
import Stats from './pages/Stats.jsx';
import { QuizDetail, QuizEditor, QuizTake } from './pages/Quizzes.jsx';

const NAV = {
  manager: [
    ['/', 'Розклад', IconCalendar],
    ['/lessons', 'Уроки', IconLesson],
    ['/courses', 'Курси', IconRoadmap],
    ['/subscriptions', 'Абонементи', IconTicket],
    ['/people', 'Люди', IconPeople],
    ['/homework', 'Завдання', IconHomework],
    ['/stats', 'Статистика', IconChart],
  ],
  teacher: [
    ['/', 'Розклад', IconCalendar],
    ['/lessons', 'Уроки', IconLesson],
    ['/courses', 'Курси', IconRoadmap],
    ['/homework', 'Завдання', IconHomework],
  ],
  student: [
    ['/', 'Розклад', IconCalendar],
    ['/homework', 'Завдання', IconHomework],
    ['/courses', 'Курси', IconRoadmap],
    ['/subscription', 'Абонемент', IconTicket],
  ],
};
const ROLE_NAME = { manager: 'Менеджер', teacher: 'Вчитель', student: 'Учень' };

/* Ширина бокової панелі: тягнеться за край, подвійний клік згортає до іконок. Запам'ятовується в браузері. */
const RAIL_MIN = 180;
const RAIL_MAX = 380;
const RAIL_DEFAULT = 232;
const RAIL_COLLAPSED = 76;
const clampRail = (w) => Math.min(RAIL_MAX, Math.max(RAIL_MIN, Math.round(w)));
const remembered = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};
const remember = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* сховище недоступне */ }
};

function useRail() {
  const [width, setWidth] = useState(() => clampRail(Number(remembered('bs-rail-width', RAIL_DEFAULT)) || RAIL_DEFAULT));
  const [collapsed, setCollapsed] = useState(() => remembered('bs-rail-collapsed', false) === true);
  useEffect(() => remember('bs-rail-width', width), [width]);
  useEffect(() => remember('bs-rail-collapsed', collapsed), [collapsed]);
  return { width, setWidth, collapsed, setCollapsed };
}

function RailResizer({ rail }) {
  const { width, setWidth, collapsed, setCollapsed } = rail;
  const dragEnd = useRef(null);
  const startDrag = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = collapsed ? RAIL_COLLAPSED : width;
    let moved = false;
    const move = (ev) => {
      const next = startW + ev.clientX - startX;
      if (!moved && Math.abs(ev.clientX - startX) < 3) return;
      moved = true;
      document.body.classList.add('is-resizing');
      // Згорнуту панель тягнемо назовні: вона розгортається і далі розширюється.
      if (collapsed && next > RAIL_COLLAPSED + 24) setCollapsed(false);
      if (!collapsed || next > RAIL_COLLAPSED + 24) setWidth(clampRail(next));
    };
    // Прибираємо обробники за будь-якого завершення: відпускання, скасування чи втрати захоплення курсора.
    const up = () => {
      document.body.classList.remove('is-resizing');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      handle.removeEventListener('lostpointercapture', up);
      dragEnd.current = null;
    };
    dragEnd.current?.();
    dragEnd.current = up;
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
    handle.addEventListener('lostpointercapture', up);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setCollapsed(false);
      setWidth(clampRail(width + (e.key === 'ArrowRight' ? 16 : -16)));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setCollapsed(!collapsed);
    }
  };
  return (
    <div className="rail-resizer" role="separator" aria-orientation="vertical" tabIndex={0}
      aria-label="Ширина бокової панелі. Подвійний клік або Enter згортає й розгортає"
      aria-valuemin={RAIL_MIN} aria-valuemax={RAIL_MAX} aria-valuenow={collapsed ? RAIL_COLLAPSED : width}
      title="Тягніть, щоб змінити ширину. Подвійний клік: згорнути або розгорнути"
      onPointerDown={startDrag} onDoubleClick={() => setCollapsed(!collapsed)} onKeyDown={onKey} />
  );
}

/**
 * Лічильник сповіщень учня: непройдені тести та нові оцінки чи відгуки до домашніх.
 * Оновлюється під час переходів, щохвилини та після дій (подія bs:notify).
 */
function useNotifications(user) {
  const [count, setCount] = useState(0);
  const location = useLocation();
  const refresh = useCallback(() => {
    if (user.role !== 'student') return;
    api('/notifications').then((r) => setCount(r.count)).catch(() => {});
  }, [user.role]);
  useEffect(() => { refresh(); }, [refresh, location.pathname]);
  useEffect(() => {
    if (user.role !== 'student') return undefined;
    const timer = setInterval(refresh, 60_000);
    window.addEventListener('bs:notify', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('bs:notify', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh, user.role]);
  return count;
}

function Shell() {
  const { user, logout } = useAuth();
  const items = NAV[user.role];
  const rail = useRail();
  const unread = useNotifications(user);
  return (
    <div className={`shell ${rail.collapsed ? 'is-collapsed' : ''}`} style={{ '--rail-w': `${rail.collapsed ? RAIL_COLLAPSED : rail.width}px` }}>
      <aside className="rail">
        <RailResizer rail={rail} />
        <div className="rail-top">
          <NavLink to="/" className="wordmark" aria-label="Be Smart School, на головну">
            <span className="wordmark-full">
              <span>Be</span>
              <span className="wordmark-stack"><span>Smart</span><span>School</span></span>
            </span>
            <span className="wordmark-short" aria-hidden="true">BS</span>
          </NavLink>
          <div className="rail-top-tools only-mobile">
            {/* На телефоні статистика у верхній панелі: нижня вміщує лише шість вкладок */}
            {user.role === 'manager' && (
              <NavLink to="/stats" className="theme-btn top-link" aria-label="Статистика" title="Статистика"><IconChart /></NavLink>
            )}
            <ThemeButton />
            <NavLink to="/profile" className="avatar" aria-label={`Профіль: ${user.name}`}>{initials(user.name)}</NavLink>
          </div>
        </div>
        <nav className="rail-nav" aria-label="Основна навігація">
          {items.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={to === '/stats' ? 'only-desktop' : undefined} title={rail.collapsed ? label : undefined}>
              <span className="nav-ico">
                <Icon />
                {to === '/homework' && unread > 0 && <b className="nav-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</b>}
              </span>
              <span>{label}</span>
              {to === '/homework' && unread > 0 && <span className="sr">, нових: {unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="rail-foot">
          <NavLink to="/profile" className="rail-user" title={rail.collapsed ? user.name : undefined}>
            <span className="avatar">{initials(user.name)}</span>
            <span className="rail-user-text">
              <strong>{user.name}</strong>
              <small>{ROLE_NAME[user.role]}</small>
            </span>
          </NavLink>
          <div className="rail-tools">
            <ThemeButton />
            <button type="button" className="theme-btn" onClick={logout} aria-label="Вийти" title="Вийти"><IconLogout /></button>
          </div>
        </div>
      </aside>
      <main className="page">
        <Routes>
          <Route path="/" element={<Schedule />} />
          <Route path="/homework" element={<Homework />} />
          <Route path="/homework/:id" element={<HomeworkDetail />} />
          {(user.role === 'student' || user.role === 'manager') && <Route path="/tests/:id" element={<QuizTake />} />}
          {user.role === 'manager' && <Route path="/quizzes/new" element={<QuizEditor />} />}
          {user.role === 'manager' && <Route path="/quizzes/:id" element={<QuizDetail />} />}
          {user.role === 'manager' && <Route path="/quizzes/:id/edit" element={<QuizEditor />} />}
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/profile" element={<Profile />} />
          {user.role !== 'student' && <Route path="/lessons" element={<Lessons />} />}
          {user.role === 'manager' && <Route path="/subscriptions" element={<Subscriptions />} />}
          {user.role === 'manager' && <Route path="/people" element={<People />} />}
          {user.role === 'manager' && <Route path="/stats" element={<Stats />} />}
          {user.role === 'student' && <Route path="/subscription" element={<MySubscription />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    api('/auth/me').then(setUser).catch(() => setUser(null));
    const out = () => setUser(null);
    window.addEventListener('zoshyt:logout', out);
    return () => window.removeEventListener('zoshyt:logout', out);
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  if (user === undefined) return null;
  return (
    <AuthCtx.Provider value={{ user, setUser, logout }}>
      <UIProvider>
        <BrowserRouter>{user ? <Shell /> : <Login onLogin={setUser} />}</BrowserRouter>
      </UIProvider>
    </AuthCtx.Provider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
