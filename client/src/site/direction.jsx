/*
 * Картка курсу (course-card.css): 3D-сцена «маскот + один предмет» → вік і рівень → [передумова] → назва →
 * опис для батьків → чипи (2 теми + результат) → «Записати дитину» і «Програма курсу →».
 * Сцени — один WebGL-контекст на секцію (SceneHost + scene/), у кожній картці — свій <View>.
 * До завантаження 3D і замість нього (менше руху, економія трафіку, без WebGL2, ≤ 2 ядра) — статичний постер.
 * Тут же — слайдер для головної (на десктопі 3 картки в ряд) і список із фільтром за віком (?age=).
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Atom, Braces, Clapperboard, Database, FileCode, Flag, Folder, Image, Keyboard, Lightbulb, MousePointerClick,
  Puzzle, Repeat, Server, ShieldCheck,
} from 'lucide-react';
import { useLead } from './ctx.js';
import { prefersCalm } from './motion.jsx';
import { directionPath } from './seo.js';
import { AGE_FILTERS, LEVELS, agesLabel, fitsAge, resultLabel } from './directions.js';
import './course-card.css';

const ICONS = {
  atom: Atom, braces: Braces, clapperboard: Clapperboard, database: Database, 'file-code': FileCode, folder: Folder,
  image: Image, keyboard: Keyboard, lightbulb: Lightbulb, 'mouse-pointer-click': MousePointerClick, puzzle: Puzzle,
  repeat: Repeat, server: Server, 'shield-check': ShieldCheck,
};

/* ───────── 3D: чи можна, завантаження, один Canvas на секцію ───────── */

/** Чи є WebGL2 — перевіряємо один раз і одразу звільняємо пробний контекст (браузер тримає їх обмежено, ~16). */
let webgl2 = null;
function hasWebGL2() {
  if (webgl2 == null) {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      webgl2 = Boolean(gl);
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { webgl2 = false; }
  }
  return webgl2;
}

function canUse3D() {
  if (typeof window === 'undefined' || prefersCalm()) return false;
  if (navigator.connection?.saveData) return false;
  if ((navigator.hardwareConcurrency || 4) <= 2) return false;
  return hasWebGL2();
}

let scenesPromise = null;
const loadScenes = () => (scenesPromise ??= import('./scene/index.jsx'));

/** Модуль сцен — після завантаження сторінки, коли браузер вільний (three.js не заважає першому екрану). */
function useScenes() {
  const [mod, setMod] = useState(null);
  useEffect(() => {
    if (!canUse3D()) return undefined;
    let off = false;
    const go = () => loadScenes().then((m) => { if (!off) setMod(m); }).catch(() => {});
    const idle = () => (window.requestIdleCallback ? window.requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 600));
    if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once: true });
    return () => { off = true; window.removeEventListener('load', idle); };
  }, []);
  return mod;
}

const SceneCtx = createContext(null);

/**
 * Обгортка секції з одним Canvas поверх неї (absolute): поверх доріжки слайдера — тож сусідні слайди за її
 * краєм не малюються — або поверх усього списку. Скролиться разом із картками, без запізнення.
 */
function SceneHost({ scrollRef, className = '', children }) {
  const host = useRef(null);
  const mod = useScenes();
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = host.current;
    if (!el || !mod) return undefined;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: '120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [mod]);
  return (
    <div ref={host} className={`cc-host ${className}`}>
      <SceneCtx.Provider value={mod}>{children}</SceneCtx.Provider>
      {mod && <mod.SceneCanvas eventSource={host} active={active} scrollEl={scrollRef} />}
    </div>
  );
}

/**
 * Сцена картки: постер одразу (і замість 3D), над ним — 3D, лише поки картка на екрані.
 * Тап (зсув < 8 px і < 250 мс) — інтерактив сцени; довший рух — це свайп слайдера. Тап курс не відкриває.
 */
function SceneSlot({ d, eager }) {
  const mod = useContext(SceneCtx);
  const ref = useRef(null);
  const down = useRef(null);
  const [visible, setVisible] = useState(false);
  const [live, setLive] = useState(false);
  const [tap, setTap] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || !mod) return undefined;
    const io = new IntersectionObserver(([e]) => { setVisible(e.isIntersecting); if (!e.isIntersecting) setLive(false); }, { rootMargin: '80px' });
    io.observe(el);
    return () => io.disconnect();
  }, [mod]);
  const onReady = useCallback(() => setLive(true), []);
  return (
    <div ref={ref} className={`cc-scene ${live ? 'is-live' : ''}`} aria-hidden="true"
      onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY, t: performance.now() }; }}
      onPointerUp={(e) => {
        const s = down.current; down.current = null;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8 && performance.now() - s.t < 250) setTap((n) => n + 1);
      }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <img className="cc-poster" src={`/posters/${d.scene}.webp`} alt="" width="800" height="600" draggable="false"
        loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async"
        onError={(e) => e.currentTarget.classList.add('is-broken')} />
      {mod && visible && <mod.CardScene scene={d.scene} look={d.look} face={d.mascotFace} tap={tap} onReady={onReady} />}
    </div>
  );
}

/* ───────── Картка ───────── */

/** Поява при скролі (fade + 16 px), разово; картки, видимі одразу, не ховаються. */
function useReveal() {
  const ref = useRef(null);
  const [pre, setPre] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || prefersCalm()) return undefined;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.left < window.innerWidth) return undefined;
    setPre(true);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setPre(false); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, pre];
}

const resultAria = (r) => (r.kind === 'result' ? `Результат курсу: ${r.label}` : r.kind === 'portfolio' ? 'Фінальний проєкт у портфоліо' : `Фінальний проєкт: ${r.label}`);

export function CourseCard({ d, all, eager = false }) {
  const lead = useLead();
  const [ref, pre] = useReveal();
  const t = d.look;
  const style = {
    '--card-bg': t.bg, '--card-bg2': t.bg2 ?? t.bg, '--card-accent': t.accent, '--card-ink': t.ink,
    '--card-muted': t.muted, '--card-on-accent': t.onAccent,
  };
  return (
    <article ref={ref} className={['cc', `is-${d.id}`, t.dark && 'is-dark', pre && 'is-pre'].filter(Boolean).join(' ')} style={style}>
      <SceneSlot d={d} eager={eager} />
      <div className="cc-body">
        <p className="cc-tags">
          <span className="cc-tag cc-age">{agesLabel(d.ages)}</span>
          <span className="cc-tag cc-level">{LEVELS[d.level]}</span>
          {d.isNew && <span className="cc-new">Нове!</span>}
        </p>
        {d.level === 'next' && d.prerequisite && <p className="cc-pre">{d.prerequisite}</p>}
        <h3 className="cc-title">{d.titleMain}{d.titleAccent && <> <em>{d.titleAccent}</em></>}</h3>
        <p className="cc-desc">{d.summary}</p>
        <ul className="cc-chips">
          {d.chips.map(([icon, label]) => {
            const Icon = ICONS[icon];
            return <li key={label} className="cc-chip">{Icon && <Icon aria-hidden="true" strokeWidth={2.2} />}{label}</li>;
          })}
          <li className="cc-chip is-result" aria-label={resultAria(d.result)}><Flag aria-hidden="true" strokeWidth={2.4} />{resultLabel(d.result)}</li>
        </ul>
        <div className="cc-actions">
          <button type="button" className="cc-go" aria-label={`Записати дитину на курс ${d.title}`} onClick={() => lead(`Курс: ${d.title}`)}>{d.ctaLabel}</button>
          {/* розтягнуте посилання: його ::after накриває картку (крім сцени й кнопки) */}
          <Link to={directionPath(d, all)} className="cc-more">Програма курсу<span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </article>
  );
}

/* ───────── Список із фільтром за віком ───────── */

/** 1 курс, 2 курси, 5 курсів */
function coursesWord(n) {
  const a = n % 10; const b = n % 100;
  if (a === 1 && b !== 11) return 'курс';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'курси';
  return 'курсів';
}

/** Картка, що не підходить за віком: тане за 250 мс і виходить із сітки; недоступна з клавіатури. */
function Fold({ show, children }) {
  const [out, setOut] = useState(false);
  const [gone, setGone] = useState(false);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; if (!show) { setOut(true); setGone(true); } return undefined; }
    if (show) {
      setGone(false);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setOut(false)));
      return () => cancelAnimationFrame(r);
    }
    setOut(true);
    const t = setTimeout(() => setGone(true), 250);
    return () => clearTimeout(t);
  }, [show]);
  return <div className={`cc-fold ${out ? 'is-out' : ''}`} hidden={gone} inert={!show} aria-hidden={show ? undefined : true}>{children}</div>;
}

/** Усі курси, від молодших до старших, з перемикачем «Мені: Всі, 6–9, 10–13, 14–18». */
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
      <SceneHost className="cc-list">
        {items.map((d, k) => <Fold key={d.id} show={fitsAge(d, age)}><CourseCard d={d} all={items} eager={k === 0} /></Fold>)}
      </SceneHost>
    </>
  );
}

/* ───────── Слайдер ───────── */

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

/** Крок слайдера (ширина слайда + проміжок) і скільки слайдів видно разом: 1 на телефоні й планшеті, 3 на десктопі. */
function measure(el) {
  const first = el.firstElementChild;
  if (!first) return { step: el.clientWidth || 1, per: 1 };
  const cs = getComputedStyle(el);
  const gap = parseFloat(cs.columnGap) || 0;
  const step = first.getBoundingClientRect().width + gap;
  // ширина без бічних полів (вони — запас для тіні карток)
  const inner = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  return { step, per: Math.max(1, Math.round((inner + gap) / step)) };
}

/** Курси слайдером (головна, «Інші курси»). Гортається стрілками по одному або пальцем (scroll-snap). */
export function DirectionSlider({ items, title = 'Курси' }) {
  const track = useRef(null);
  const [at, setAt] = useState(0);
  const [per, setPer] = useState(1);
  const go = useCallback((k) => {
    const el = track.current;
    if (!el) return;
    const m = measure(el);
    const n = Math.max(0, Math.min(items.length - m.per, k));
    el.scrollTo({ left: n * m.step, behavior: prefersCalm() ? 'auto' : 'smooth' });
  }, [items.length]);
  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    const on = () => { const m = measure(el); setPer(m.per); setAt(Math.round(el.scrollLeft / m.step)); };
    on();
    el.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { el.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);
  return (
    <section className="s-wrap s-sec cc-sec" aria-roledescription="карусель" aria-label={title}>
      <div className="s-sec-head">
        <h2>{title}</h2>
        <div className="s-dir-nav">
          <PillArrow left label="Попередній курс" disabled={at <= 0} onClick={() => go(at - 1)} />
          <PillArrow label="Наступний курс" disabled={at >= items.length - per} onClick={() => go(at + 1)} />
        </div>
      </div>
      <SceneHost scrollRef={track} className="cc-track-host">
        <div className="s-dir-track" ref={track}>
          {items.map((d, k) => (
            <div key={d.id} className="s-dir-slide" aria-roledescription="слайд" aria-label={`${k + 1} з ${items.length}`}>
              <CourseCard d={d} all={items} eager={k === 0} />
            </div>
          ))}
        </div>
      </SceneHost>
    </section>
  );
}
