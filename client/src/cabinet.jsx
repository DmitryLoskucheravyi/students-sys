/*
 * Кабінет школи (CRM) під /cabinet: розклад, курси, абонементи, завдання.
 * Окремий шматок коду: відвідувач сайту його не завантажує.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { RouteBoundary } from './ErrorBoundary.jsx';
import { UIProvider } from './ui.jsx';
import { AuthCtx, ThemeButton, useAuth } from './session.jsx';
import { IconCalendar, IconChart, IconGlobe, IconHomework, IconLesson, IconLogout, IconPeople, IconRoadmap, IconTicket } from './icons.jsx';
import { Avatar } from './avatars.jsx';
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
import SiteAdmin from './pages/SiteAdmin.jsx';
import { PublicQuiz, QuizDetail, QuizEditor, QuizTake } from './pages/Quizzes.jsx';

const NAV = {
  manager: [
    ['/', 'Розклад', IconCalendar],
    ['/lessons', 'Уроки', IconLesson],
    ['/courses', 'Курси', IconRoadmap],
    ['/subscriptions', 'Абонементи', IconTicket],
    ['/people', 'Люди', IconPeople],
    ['/homework', 'Завдання', IconHomework],
    ['/stats', 'Статистика', IconChart],
    ['/site', 'Сайт', IconGlobe],
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
 * Лічильник сповіщень. Учень: непройдені тести та нові оцінки чи відгуки до домашніх. Менеджер: тести вчителів на модерації.
 * Оновлюється під час переходів, щохвилини та після дій (подія bs:notify).
 */
function useNotifications(user) {
  const [count, setCount] = useState(0);
  const location = useLocation();
  const refresh = useCallback(() => {
    if (user.role === 'teacher') return;
    api('/notifications').then((r) => setCount(r.count)).catch(() => {});
  }, [user.role]);
  useEffect(() => { refresh(); }, [refresh, location.pathname]);
  useEffect(() => {
    if (user.role === 'teacher') return undefined;
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

/** Менеджер: скільки нових заявок із сайту. Оновлюється так само, як сповіщення. */
function useNewLeads(user) {
  const [count, setCount] = useState(0);
  const location = useLocation();
  const manager = user.role === 'manager';
  const refresh = useCallback(() => {
    if (manager) api('/site-admin/leads/new').then((r) => setCount(r.count)).catch(() => {});
  }, [manager]);
  useEffect(() => { refresh(); }, [refresh, location.pathname]);
  useEffect(() => {
    if (!manager) return undefined;
    const timer = setInterval(refresh, 60_000);
    window.addEventListener('bs:notify', refresh);
    return () => { clearInterval(timer); window.removeEventListener('bs:notify', refresh); };
  }, [refresh, manager]);
  return count;
}

function Shell() {
  const { user, logout } = useAuth();
  const items = NAV[user.role];
  const rail = useRail();
  const unread = useNotifications(user);
  const leads = useNewLeads(user);
  const badge = (to) => (to === '/homework' ? unread : to === '/site' ? leads : 0);
  return (
    <div className={`shell ${rail.collapsed ? 'is-collapsed' : ''}`} style={{ '--rail-w': `${rail.collapsed ? RAIL_COLLAPSED : rail.width}px` }}>
      <aside className="rail">
        <RailResizer rail={rail} />
        <div className="rail-top">
          <NavLink to="/" className="wordmark" aria-label="Be Smart School, на головну">
            <span className="wordmark-full">
              <span className="wordmark-be">BE</span>
              <span className="wordmark-stack"><span>Smart</span><span>School</span></span>
            </span>
            <span className="wordmark-short" aria-hidden="true">BS</span>
          </NavLink>
          <div className="rail-top-tools only-mobile">
            {/* На телефоні статистика й сайт у верхній панелі: нижня вміщує лише шість вкладок */}
            {user.role === 'manager' && (
              <>
                <NavLink to="/site" className="theme-btn top-link" aria-label={leads ? `Сайт, нових заявок: ${leads}` : 'Сайт'} title="Сайт">
                  <IconGlobe />{leads > 0 && <b className="nav-badge" aria-hidden="true">{leads > 9 ? '9+' : leads}</b>}
                </NavLink>
                <NavLink to="/stats" className="theme-btn top-link" aria-label="Статистика" title="Статистика"><IconChart /></NavLink>
              </>
            )}
            <ThemeButton />
            <NavLink to="/profile" className="avatar-link" aria-label={`Профіль: ${user.name}`}><Avatar user={user} /></NavLink>
          </div>
        </div>
        <nav className="rail-nav" aria-label="Основна навігація">
          {items.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={to === '/stats' || to === '/site' ? 'only-desktop' : undefined} title={rail.collapsed ? label : undefined}>
              <span className="nav-ico">
                <Icon />
                {badge(to) > 0 && <b className="nav-badge" aria-hidden="true">{badge(to) > 9 ? '9+' : badge(to)}</b>}
              </span>
              <span>{label}</span>
              {badge(to) > 0 && <span className="sr">, нових: {badge(to)}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="rail-foot">
          <NavLink to="/profile" className="rail-user" title={rail.collapsed ? user.name : undefined}>
            <Avatar user={user} />
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
        <RouteBoundary>
          <Routes>
            <Route path="/" element={<Schedule />} />
            <Route path="/homework" element={<Homework />} />
            <Route path="/homework/:id" element={<HomeworkDetail />} />
            {(user.role === 'student' || user.role === 'manager') && <Route path="/tests/:id" element={<QuizTake />} />}
            {user.role !== 'student' && <Route path="/quizzes/new" element={<QuizEditor />} />}
            {user.role !== 'student' && <Route path="/quizzes/:id" element={<QuizDetail />} />}
            {user.role !== 'student' && <Route path="/quizzes/:id/edit" element={<QuizEditor />} />}
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/profile" element={<Profile />} />
            {user.role !== 'student' && <Route path="/lessons" element={<Lessons />} />}
            {user.role === 'manager' && <Route path="/subscriptions" element={<Subscriptions />} />}
            {user.role === 'manager' && <Route path="/people" element={<People />} />}
            {user.role === 'manager' && <Route path="/stats" element={<Stats />} />}
            {user.role === 'manager' && <Route path="/site" element={<SiteAdmin />} />}
            {user.role === 'student' && <Route path="/subscription" element={<MySubscription />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RouteBoundary>
      </main>
    </div>
  );
}

/** Поточний користувач: undefined — ще завантажується, null — не увійшов. */
function useMe() {
  const [user, setUser] = useState(undefined);
  // Назва вкладки кабінету: в index.html стоїть назва сайту школи.
  useEffect(() => { document.title = 'Be Smart School'; }, []);

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

  return { user, setUser, logout };
}

/** Кабінет: без входу — сторінка входу, після входу — система. Усі шляхи всередині відносно /cabinet. */
export default function Cabinet() {
  const auth = useMe();
  if (auth.user === undefined) return null;
  return (
    <AuthCtx.Provider value={auth}>
      <UIProvider>
        <BrowserRouter basename="/cabinet">
          <Routes>
            <Route path="*" element={auth.user ? <Shell /> : <Login onLogin={auth.setUser} />} />
          </Routes>
        </BrowserRouter>
      </UIProvider>
    </AuthCtx.Provider>
  );
}

/** Тест за посиланням /q/:token: відкривається і без входу, лишається на старій адресі. */
export function QuizLink() {
  const auth = useMe();
  if (auth.user === undefined) return null;
  return (
    <AuthCtx.Provider value={auth}>
      <UIProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/q/:token" element={<PublicQuiz />} />
          </Routes>
        </BrowserRouter>
      </UIProvider>
    </AuthCtx.Provider>
  );
}
