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
const Site = lazy(() => import('./site/Site.jsx'));

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<BootLoader />}>{pick()}</Suspense>
    </ErrorBoundary>
  </StrictMode>
);

// версія завантажилась — наступний збій після деплою знову може перезавантажити сторінку сам
setTimeout(() => { try { sessionStorage.removeItem('bs.chunkReload'); } catch { /* приватний режим */ } }, 10000);
