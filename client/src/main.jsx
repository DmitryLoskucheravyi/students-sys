import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/onest';
import './styles.css';
import { api } from './api.js';
import { UIProvider } from './ui.jsx';
import { AuthCtx, ThemeButton, useAuth } from './session.jsx';
import { IconCalendar, IconHomework, IconLesson, IconLogout, IconPeople, IconRoadmap, IconTicket } from './icons.jsx';
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

const NAV = {
  manager: [
    ['/', 'Розклад', IconCalendar],
    ['/lessons', 'Уроки', IconLesson],
    ['/courses', 'Курси', IconRoadmap],
    ['/subscriptions', 'Абонементи', IconTicket],
    ['/people', 'Люди', IconPeople],
    ['/homework', 'Домашні', IconHomework],
  ],
  teacher: [
    ['/', 'Розклад', IconCalendar],
    ['/lessons', 'Уроки', IconLesson],
    ['/courses', 'Курси', IconRoadmap],
    ['/homework', 'Домашні', IconHomework],
  ],
  student: [
    ['/', 'Розклад', IconCalendar],
    ['/homework', 'Домашні', IconHomework],
    ['/courses', 'Курси', IconRoadmap],
    ['/subscription', 'Абонемент', IconTicket],
  ],
};
const ROLE_NAME = { manager: 'Менеджер', teacher: 'Вчитель', student: 'Учень' };

function Shell() {
  const { user, logout } = useAuth();
  const items = NAV[user.role];
  return (
    <div className="shell">
      <aside className="rail">
        <div className="rail-top">
          <NavLink to="/" className="wordmark" aria-label="Be Smart School, на головну">
            <span>Be</span>
            <span className="wordmark-stack"><span>Smart</span><span>School</span></span>
          </NavLink>
          <div className="rail-top-tools only-mobile">
            <ThemeButton />
            <NavLink to="/profile" className="avatar" aria-label={`Профіль: ${user.name}`}>{initials(user.name)}</NavLink>
          </div>
        </div>
        <nav className="rail-nav" aria-label="Основна навігація">
          {items.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="rail-foot">
          <NavLink to="/profile" className="rail-user">
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
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/profile" element={<Profile />} />
          {user.role !== 'student' && <Route path="/lessons" element={<Lessons />} />}
          {user.role === 'manager' && <Route path="/subscriptions" element={<Subscriptions />} />}
          {user.role === 'manager' && <Route path="/people" element={<People />} />}
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
