/*
 * Картка курсу — один шаблон для всіх напрямків (course-card.css):
 * чипи віку й рівня → назва з акцентом → опис про результат → шлях із 3 кроків (третій — результат) → кнопка й посилання.
 * Ілюстрація праворуч (телефон — окремою сценою зверху), кольори — CSS-змінні з directions.js (look).
 * Клік будь-де по картці веде на сторінку курсу; кнопка відкриває форму запису з уже вибраним курсом.
 * Тут же — список із фільтром за віком (?age= в адресі) і слайдер «по одній» для головної.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Atom, Braces, Briefcase, Clapperboard, Database, FileCode, Flag, Folder, Gamepad2, Globe, Image, Keyboard,
  Lightbulb, MousePointerClick, Plug, Puzzle, Repeat, Server, ShieldCheck,
} from 'lucide-react';
import { useLead } from './ctx.js';
import { prefersCalm } from './motion.jsx';
import { directionPath } from './seo.js';
import { AGE_FILTERS, LEVELS, agesLabel, fitsAge } from './directions.js';
import { COURSE_ART } from './course-art.jsx';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/cyrillic-500.css';
import './course-card.css';

const ICONS = {
  atom: Atom, braces: Braces, briefcase: Briefcase, clapperboard: Clapperboard, database: Database, 'file-code': FileCode,
  folder: Folder, 'gamepad-2': Gamepad2, globe: Globe, image: Image, keyboard: Keyboard, lightbulb: Lightbulb,
  'mouse-pointer-click': MousePointerClick, plug: Plug, puzzle: Puzzle, repeat: Repeat, server: Server, 'shield-check': ShieldCheck,
};

/** Патерн під ілюстрацією (не під текстом). Темні картки — без патерну. */
const PATTERN = { pc: 'grid', scratch: 'dots', ai: 'dots', frontend: 'grid', backend: 'grid' };

const hasHover = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: hover)').matches);

/**
 * Рух картки: поява при скролі (разово) і «мікродія» ілюстрації.
 * play — лічильник запусків: мишкою — щоразу при наведенні; на тачі — один раз, коли картка в центрі екрана.
 * Картка, видима одразу при завантаженні, не ховається; «зменшити рух» — нічого не рухається.
 */
function useCardMotion() {
  const ref = useRef(null);
  const [play, setPlay] = useState(0);
  const [pre, setPre] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || prefersCalm()) return undefined;
    const r = el.getBoundingClientRect();
    const io = [];
    if (r.top > window.innerHeight || r.left > window.innerWidth) {
      setPre(true);
      const seen = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setPre(false); seen.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
      seen.observe(el);
      io.push(seen);
    }
    if (!hasHover()) {
      const mid = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setPlay(1); mid.disconnect(); } }, { rootMargin: '-38% 0px -38% 0px' });
      mid.observe(el);
      io.push(mid);
    }
    return () => io.forEach((o) => o.disconnect());
  }, []);
  const onEnter = useCallback(() => { if (hasHover() && !prefersCalm()) setPlay((p) => p + 1); }, []);
  return { ref, play, pre, onEnter };
}

export function CourseCard({ d, all }) {
  const lead = useLead();
  const { ref, play, pre, onEnter } = useCardMotion();
  const Art = COURSE_ART[d.art];
  const href = directionPath(d, all);
  const t = d.look;
  const style = {
    '--card-bg': t.bg, '--card-bg2': t.bg2 ?? t.bg, '--card-accent': t.accent, '--card-ink': t.ink,
    '--card-muted': t.muted, '--card-on-accent': t.onAccent,
  };
  const cls = ['cc', `is-${d.art}`, t.dark && 'is-dark', PATTERN[d.art] && `has-${PATTERN[d.art]}`, pre && 'is-pre', play > 0 && 'is-play'];
  return (
    <article ref={ref} className={cls.filter(Boolean).join(' ')} style={style} onMouseEnter={onEnter}>
      <div className="cc-text">
        <p className="cc-chips">
          <span className="cc-chip cc-age">{agesLabel(d.ages)}</span>
          <span className="cc-chip cc-level">{LEVELS[d.level]}</span>
          {d.isNew && <span className="cc-new">Нове!</span>}
        </p>
        {d.note && <p className="cc-note">{d.note}</p>}
        <h3 className="cc-title">{d.titleMain}{d.titleAccent && <> <em>{d.titleAccent}</em></>}</h3>
        <p className="cc-desc">{d.summary}</p>
      </div>
      <ol className="cc-path" aria-label="Що буде на курсі">
        {d.path.map(([icon, text], k) => {
          const Icon = ICONS[icon];
          const goal = k === d.path.length - 1;
          return (
            <li key={text} className={goal ? 'is-goal' : ''}>
              <Icon className="cc-path-ico" aria-hidden="true" strokeWidth={2.2} />
              {goal && <Flag className="cc-path-flag" aria-hidden="true" strokeWidth={2.4} />}
              <span>{goal && <span className="sr-only">Результат: </span>}{text}</span>
            </li>
          );
        })}
      </ol>
      <div className="cc-actions">
        <button type="button" className="cc-go" onClick={() => lead(`Курс: ${d.title}`)}>{d.cta ?? 'Хочу на курс'}</button>
        {/* розтягнуте посилання: його ::after накриває всю картку */}
        <Link to={href} className="cc-more">Програма курсу<span aria-hidden="true">→</span></Link>
      </div>
      {Art && <div className="cc-art" aria-hidden="true"><Art play={play} /></div>}
    </article>
  );
}

/** 1 курс, 2 курси, 5 курсів */
function coursesWord(n) {
  const a = n % 10; const b = n % 100;
  if (a === 1 && b !== 11) return 'курс';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'курси';
  return 'курсів';
}

/** Обгортка, що плавно згортає картку, яка не підходить за віком (250 мс), і робить її недоступною. */
function Fold({ show, children }) {
  const [moving, setMoving] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    setMoving(true);
    const t = setTimeout(() => setMoving(false), 280);
    return () => clearTimeout(t);
  }, [show]);
  return (
    <div className={`cc-fold ${show ? '' : 'is-out'} ${moving || !show ? 'is-clip' : ''}`} inert={!show} aria-hidden={show ? undefined : true}>
      <div className="cc-fold-in">{children}</div>
    </div>
  );
}

/** Усі курси одним списком, від молодших до старших, з перемикачем «Мені: Всі, 6–9, 10–13, 14–18». */
export function CourseList({ items }) {
  const [params, setParams] = useSearchParams();
  const age = AGE_FILTERS.find((f) => f.id && f.id === params.get('age')) ?? AGE_FILTERS[0];
  const pick = (f) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (f.id) next.set('age', f.id); else next.delete('age');
    return next;
  }, { replace: true, preventScrollReset: true });
  const shown = items.filter((d) => fitsAge(d, age)).length;
  return (
    <>
      <div className="cc-filter" role="group" aria-label="Курси за віком">
        <span className="cc-filter-label" aria-hidden="true">Мені:</span>
        {AGE_FILTERS.map((f) => (
          <button key={f.id || 'all'} type="button" aria-pressed={f === age} onClick={() => pick(f)}
            aria-label={f.range ? `${f.label} років` : 'Усі курси'}>{f.label}</button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{age.range ? `${shown} ${coursesWord(shown)} для віку ${age.label} років` : ''}</p>
      <div className="cc-list">
        {items.map((d) => <Fold key={d.id} show={fitsAge(d, age)}><CourseCard d={d} all={items} /></Fold>)}
      </div>
    </>
  );
}

const Arrow = ({ left }) => (
  <svg viewBox="0 0 48 24" aria-hidden="true"><path d={left ? 'M40 12H12m9-8-9 8 9 8' : 'M8 12h28m-9-8 9 8-9 8'} /></svg>
);

/** Стрілка слайдера: помаранчева «таблетка», як у заголовку хіро. */
export function PillArrow({ left, label, disabled, onClick }) {
  return (
    <button type="button" className="s-pill-arrow" aria-label={label} disabled={disabled} onClick={onClick}>
      <Arrow left={left} />
    </button>
  );
}

/** Курси по одному на всю ширину (головна, «Інші курси»). Гортається стрілками або пальцем (scroll-snap). */
export function DirectionSlider({ items, title = 'Курси' }) {
  const track = useRef(null);
  const [at, setAt] = useState(0);
  const go = useCallback((k) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(items.length - 1, k));
    el.scrollTo({ left: n * el.clientWidth, behavior: prefersCalm() ? 'auto' : 'smooth' });
  }, [items.length]);
  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    const on = () => setAt(Math.round(el.scrollLeft / (el.clientWidth || 1)));
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);
  return (
    <section className="s-wrap s-sec cc-sec" aria-roledescription="карусель" aria-label={title}>
      <div className="s-sec-head">
        <h2>{title}</h2>
        <div className="s-dir-nav">
          <PillArrow left label="Попередній курс" disabled={at <= 0} onClick={() => go(at - 1)} />
          <PillArrow label="Наступний курс" disabled={at >= items.length - 1} onClick={() => go(at + 1)} />
        </div>
      </div>
      <div className="s-dir-track" ref={track}>
        {items.map((d, k) => (
          <div key={d.id} className="s-dir-slide" aria-roledescription="слайд" aria-label={`${k + 1} з ${items.length}`}>
            <CourseCard d={d} all={items} />
          </div>
        ))}
      </div>
    </section>
  );
}
