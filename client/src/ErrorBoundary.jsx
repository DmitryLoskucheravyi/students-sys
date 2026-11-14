/*
 * Запобіжник: помилка в будь-якому компоненті показує екран «Щось пішло не так» замість білої сторінки.
 * Окремий випадок — після деплою старі шматки коду зникають із сервера; тоді сторінка один раз
 * перезавантажується сама, щоб підтягнути нову версію.
 */
import { Component, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isChunkError } from './chunkError.js';

const RELOADED = 'bs.chunkReload';

function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOADED)) return false;
    sessionStorage.setItem(RELOADED, '1');
  } catch { return false; }
  window.location.reload();
  return true;
}

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) {
    if (isChunkError(error) && reloadOnce()) return;
    console.error(error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    // перехід на іншу сторінку знімає помилку
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const stale = isChunkError(this.state.error);
    return (
      <div className="crash" role="alert">
        <p className="crash-mark" aria-hidden="true">:(</p>
        <h1>{stale ? 'Вийшла нова версія' : 'Щось пішло не так'}</h1>
        <p>{stale ? 'Оновіть сторінку, щоб продовжити.' : 'Спробуйте оновити сторінку. Якщо не допоможе, повідомте нам.'}</p>
        <div className="crash-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Оновити сторінку</button>
          {!this.props.compact && <a className="btn btn-ghost" href="/">На головну</a>}
        </div>
      </div>
    );
  }
}

/** Лоадер першого завантаження: зʼявляється лише якщо чекати довше за 300 мс, щоб не блимав. */
export function BootLoader() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);
  return show ? <div className="loader is-boot" role="status" aria-label="Завантаження"><span /></div> : null;
}

/** Запобіжник для вмісту сторінки: шапка й меню лишаються, перехід на іншу адресу знімає помилку. */
export function RouteBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname} compact>{children}</ErrorBoundary>;
}
