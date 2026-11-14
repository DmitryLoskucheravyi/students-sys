/* Рух на сайті: медіазапити, «зʼявитись, коли видно», повага до «зменшити рух». */
import { useEffect, useRef, useState } from 'react';

/** Користувач просив менше руху: анімації не крутяться, усе видно одразу. */
export const prefersCalm = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** Чи підходить медіазапит, з оновленням при зміні ширини. */
export function useMedia(query) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/**
 * Елемент уже потрапляв на екран: стає true один раз і більше не скидається.
 * Без IntersectionObserver або з «менше руху» — одразу true.
 */
export function useSeenOnce({ threshold = 0, rootMargin = '0px' } = {}) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || prefersCalm()) { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold, rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);
  return [ref, seen];
}

/** Зʼявляється, коли доскролили: кожен елемент окремо, тож контент виростає поступово. */
export function Reveal({ as: Tag = 'div', className = '', delay = 0, children }) {
  const [ref, seen] = useSeenOnce({ rootMargin: '0px 0px -15% 0px' });
  return <Tag ref={ref} className={`s-reveal ${seen ? 'is-in' : ''} ${className}`} style={{ '--d': `${delay}ms` }}>{children}</Tag>;
}
