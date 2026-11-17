/*
 * Точка входу. Три частини, кожна своїм шматком коду:
 *   /cabinet/…  кабінет школи (вхід і система)
 *   /q/:token   тест за посиланням
 *   решта       сайт школи
 * Старі адреси кабінету (/homework, /lessons…) переадресовуються в /cabinet, щоб закладки й посилання не зламались.
 */
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/onest';
import './styles.css';
import ErrorBoundary, { BootLoader } from './ErrorBoundary.jsx';

const Cabinet = lazy(() => import('./cabinet.jsx'));
const QuizLink = lazy(() => import('./cabinet.jsx').then((m) => ({ default: m.QuizLink })));
// Сайт уже зібрано в HTML (scripts/prerender.mjs): його код вантажиться одразу, а React підміняє готову розмітку,
// щойно код прийде, — без проміжного екрана завантаження.
const isSite = (p) => !(p === '/cabinet' || p.startsWith('/cabinet/') || p.startsWith('/q/'));
const sitePromise = isSite(window.location.pathname) ? import('./site/Site.jsx') : null;
const Site = lazy(() => sitePromise ?? import('./site/Site.jsx'));

const LEGACY = /^\/(homework|lessons|people|stats|subscriptions|subscription|profile|tests|quizzes)(\/|$)/;

function pick() {
  const { pathname, search, hash } = window.location;
  if (LEGACY.test(pathname)) {
    window.location.replace(`/cabinet${pathname}${search}${hash}`);
    return null;
  }
  if (pathname === '/cabinet' || pathname.startsWith('/cabinet/')) return <Cabinet />;
  if (pathname.startsWith('/q/')) return <QuizLink />;
  return <Site />;
}

const mount = () => createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<BootLoader />}>{pick()}</Suspense>
    </ErrorBoundary>
  </StrictMode>
);
// Збій завантаження — теж монтуємо: lazy поверне ту саму помилку, і ErrorBoundary її обробить
if (sitePromise) sitePromise.then(mount, mount);
else mount();

// версія завантажилась — наступний збій після деплою знову може перезавантажити сторінку сам
setTimeout(() => { try { sessionStorage.removeItem('bs.chunkReload'); } catch { /* приватний режим */ } }, 10000);
