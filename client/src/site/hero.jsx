/*
 * Перший екран: роадмап карток і шторка «пробне заняття».
 * Розрахунки (скільки карток відкрито, чи можна висувати шторку) — чисті функції з logic.js;
 * тут лише читаємо розміри з DOM і перемикаємо класи, без React-рендеру на кожен кадр прокрутки.
 */
import { useEffect, useRef, useState } from 'react';
import { IconRight, IconSpark } from '../icons.jsx';
import { desktopProgress, mobileProgress, peekReady, shownCount } from './logic.js';
import { prefersCalm } from './motion.jsx';

const WIDE = '(min-width: 900px)';
const isWide = () => window.matchMedia(WIDE).matches;

/* ───────── Роадмап ───────── */

const ROAD = [
  { label: 'Старт', title: 'Новачок у програмуванні' },
  { label: 'Крок 1', title: 'Перша програма' },
  { label: 'Крок 2', title: 'Свій сайт або гра' },
  { label: 'Крок 3', title: 'Проєкт у команді' },
];
const FINISH = [
  { face: ':)', text: 'Впевнено володію навичками' },
  { face: ':D', text: 'Опанував найновіші технології' },
  { face: 'B)', text: 'Маю портфоліо та сертифікат' },
];
const CONFETTI = [[-110, -60, '#ffd479'], [96, -74, '#fff'], [-150, 6, '#a3e6b0'], [150, -6, '#ffd479'], [-70, -100, '#fff'], [70, -102, '#a7d4ff'], [0, -118, '#ff9aa7'], [-170, -38, '#fff'], [172, -42, '#a3e6b0'], [30, -90, '#ffd479'], [-30, -130, '#a7d4ff'], [124, -110, '#ff9aa7']];

/** Скільки карток відкрити зараз — за прокруткою і розмірами на екрані. */
function measureShown(root, total) {
  const vh = window.innerHeight;
  if (isWide()) {
    const hero = root.closest('.s-hero');
    const p = desktopProgress({
      heroTop: hero?.getBoundingClientRect().top ?? 0,
      heroHeight: hero?.offsetHeight ?? vh,
      vh,
      head: document.querySelector('.s-head')?.offsetHeight ?? 0,
    });
    return shownCount(p, total, { wide: true });
  }
  const p = mobileProgress({ roadmapBottom: root.getBoundingClientRect().bottom, scrollY: window.scrollY, vh });
  return shownCount(p, total, { wide: false });
}

/**
 * Роадмап без дороги: картки кроків зʼявляються по черзі з прокруткою, далі «Фініш», і до нього
 * по одному підкріплюються пункти зі смайликами. Гортаєте вгору — ховаються у зворотному порядку.
 * Компʼютер: хіро прилипає, поки йде анімація. Телефон: «Старт» видно одразу.
 */
export function HeroArt() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const items = [...root.querySelectorAll('[data-step]')];
    const finish = root.querySelector('.s-rm-finish');
    const apply = (n) => {
      items.forEach((el, i) => el.classList.toggle('is-on', i < n));
      finish.classList.toggle('is-done', n === items.length);
    };
    if (prefersCalm()) { apply(items.length); return undefined; }
    let raf = 0;
    const update = () => { raf = 0; apply(measureShown(root, items.length)); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div className="s-hero-art" aria-hidden="true">
      <div className="s-roadmap" ref={ref}>
        <ol className="s-rm-steps">
          {ROAD.map((st, k) => (
            <li key={st.title} data-step className={`s-rm-card ${k % 2 ? 'is-r' : 'is-l'}`}>
              <span className="s-rm-n">{k === 0 ? <IconRight size={16} /> : k}</span>
              <span><small>{st.label}</small>{st.title}</span>
            </li>
          ))}
        </ol>
        <div className="s-rm-finish" data-step>
          <span className="s-confetti">{CONFETTI.map(([x, y, c], k) => <i key={k} style={{ '--x': `${x}px`, '--y': `${y}px`, '--c': c, '--r': `${k * 47}deg`, '--k': k }} />)}</span>
          <div className="s-rm-finish-head">
            <Medal />
            <span><small>Фініш</small><b>Ви — програміст</b></span>
          </div>
          <ul className="s-rm-points">
            {FINISH.map((f) => (
              <li key={f.text} data-step className="s-rm-point">
                <span className="s-rm-face">{f.face}</span>{f.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Medal() {
  return (
    <svg className="s-medal" viewBox="0 0 48 48">
      <path d="M15 26 10 44l7-4 4 6 3-14zM33 26l5 18-7-4-4 6-3-14z" fill="#d6112b" />
      <circle cx="24" cy="20" r="15" fill="#ffd479" stroke="#e5a91a" strokeWidth="3" />
      <path d="M24 11.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="#fff" />
    </svg>
  );
}

/* ───────── Шторка «пробне заняття» ───────── */

const PEEK_KEY = 'bs.trialPeek';
const PEEK_DELAY = 700; // кнопка має пробути на місці мить
const PEEK_HOLD = 12000;
const PEEK_OUT = 700;

function peekSeen() {
  try { return sessionStorage.getItem(PEEK_KEY) === '1'; } catch { return false; } // приватний режим
}
function markPeekSeen() {
  try { sessionStorage.setItem(PEEK_KEY, '1'); } catch { /* приватний режим */ }
}

/**
 * Шторка під кнопкою в хіро: висувається, коли кнопка стоїть на своєму місці в кадрі,
 * висить 12 с і ховається. Лише раз за сесію.
 */
export function TrialPeek() {
  const ref = useRef(null);
  const [state, setState] = useState('hidden'); // hidden → open → closing → done
  useEffect(() => {
    const anchor = ref.current?.parentElement;
    if (!anchor || peekSeen()) return undefined;
    const panel = anchor.closest('.s-hero-panel');
    let wait = 0;
    const timers = [];
    const open = () => {
      stop();
      markPeekSeen();
      setState('open');
      timers.push(setTimeout(() => setState('closing'), PEEK_HOLD), setTimeout(() => setState('done'), PEEK_HOLD + PEEK_OUT));
    };
    const check = () => {
      const r = anchor.getBoundingClientRect();
      const ready = peekReady({
        wide: isWide(),
        panelBottom: panel?.getBoundingClientRect().bottom ?? 0,
        buttonTop: r.top,
        buttonBottom: r.bottom,
        vh: window.innerHeight,
      });
      clearTimeout(wait);
      if (ready) wait = setTimeout(open, PEEK_DELAY);
    };
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(check, { threshold: 1 });
    function stop() {
      io?.disconnect();
      window.removeEventListener('scroll', check);
      clearTimeout(wait);
    }
    io?.observe(anchor);
    window.addEventListener('scroll', check, { passive: true });
    check();
    return () => { stop(); timers.forEach(clearTimeout); };
  }, []);
  if (state === 'done') return null;
  return (
    <div ref={ref} className="s-peek-wrap" role="status" hidden={state === 'hidden'}>
      <div className={`s-peek ${state === 'closing' ? 'is-out' : ''}`}><IconSpark size={18} /><span>Перше пробне заняття <b>безкоштовно</b></span></div>
    </div>
  );
}

/** Двійкові цифри у фоні хіро. */
export function Bits() {
  return (
    <div className="s-bits" aria-hidden="true">
      {['1', '0', '1', '1', '0', '{ }', '0', '1', '</>', '1'].map((b, i) => (
        <span key={i} style={{ '--i': i, left: `${4 + i * 9.5}%`, top: `${10 + ((i * 37) % 70)}%` }}>{b}</span>
      ))}
    </div>
  );
}
