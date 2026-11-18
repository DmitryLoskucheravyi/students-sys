/*
 * Перший екран: маскот на пунктирній дорозі, роадмап карток і шторка «пробне заняття».
 * Розрахунки (скільки карток відкрито, чи можна висувати шторку) — чисті функції з logic.js;
 * тут лише читаємо розміри з DOM і перемикаємо класи, без React-рендеру на кожен кадр прокрутки.
 */
import { useEffect, useRef, useState } from 'react';
import { IconRight, IconSpark } from '../icons.jsx';
import { catStop, desktopProgress, mobileProgress, peekReady, shownCount, smoothPath } from './logic.js';
import { Book } from './mascot.jsx';
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
  { face: ':)', text: 'Впевнено володіє навичками' },
  { face: ':D', text: 'Опанувала найновіші технології' },
  { face: 'B)', text: 'Має портфоліо та сертифікат' },
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
 * Точки дороги (у системі координат роадмапу, без урахування zoom і зсувів анімації):
 * біля кожної картки — посередині вільного боку, остання — на фініші.
 */
function roadStops(root) {
  const W = root.offsetWidth;
  const cards = [...root.querySelectorAll('.s-rm-card')];
  const pts = cards.map((el) => {
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    const free = el.classList.contains('is-r') ? left / 2 : (right + W) / 2;
    return { x: free, y: el.offsetTop + el.offsetHeight / 2 };
  });
  const fin = root.querySelector('.s-rm-finish');
  // фініш — на вільному від останньої картки боці (вона праворуч), на верхньому краї блоку
  if (fin) pts.push({ x: fin.offsetLeft + Math.min(70, fin.offsetWidth * 0.18), y: fin.offsetTop + 8 });
  return pts;
}

/** Довжина вздовж path, на якій лінія найближче до точки (грубий перебір, точок мало). */
function lengthAt(path, total, pt) {
  let best = 0;
  let bestD = Infinity;
  for (let l = 0; l <= total; l += 4) {
    const q = path.getPointAtLength(l);
    const d = (q.x - pt.x) ** 2 + (q.y - pt.y) ** 2;
    if (d < bestD) { bestD = d; best = l; }
  }
  return best;
}

const RUN_SPEED = 0.55; // px за мс
const ROAD_AHEAD = 70; // наскільки дорога «розкручена» попереду маскота

/**
 * Роадмап — одна історія з першим екраном: маскот стоїть біля першої точки пунктирної дороги й питає «Урок 1 — погнали?».
 * З прокруткою картки кроків відкриваються по черзі, дорога розкручується, а маскот біжить нею до фінішу.
 * Що відкрилось, лишається: прокрутка вгору нічого не ховає. Компʼютер: хіро прилипає, поки йде анімація.
 */
export function HeroArt() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const items = [...root.querySelectorAll('[data-step]')];
    const finish = root.querySelector('.s-rm-finish');
    const art = root.closest('.s-hero-art');
    const svg = root.querySelector('.s-road');
    const road = root.querySelector('.s-road-line');
    const reveal = root.querySelector('.s-road-reveal');
    const cat = root.querySelector('.s-mascot');
    const say = root.querySelector('.s-mascot-say');
    let stops = [];
    let lens = [];
    let total = 0;
    let pos = 0; // де зараз маскот, довжина вздовж дороги
    let target = 0;
    let anim = 0;

    const place = (l, dir) => {
      const q = road.getPointAtLength(Math.max(0, Math.min(total, l)));
      cat.style.translate = `${q.x}px ${q.y}px`;
      if (dir) cat.classList.toggle('is-left', dir < 0);
      reveal.style.strokeDashoffset = String(Math.max(0, total - l - ROAD_AHEAD));
    };
    // Великий маскот до прокрутки: стоїть справа знизу видимої частини роадмапу (картки ще сховані)
    const placeBig = () => {
      const w = cat.offsetWidth;
      const h = cat.offsetHeight;
      const zoom = root.getBoundingClientRect().height / (root.offsetHeight || 1) || 1;
      // низ видимої частини: над кнопкою, що прилипла до низу екрана на телефоні
      const seen = (window.innerHeight - (isWide() ? 40 : 120) - root.getBoundingClientRect().top) / zoom;
      // компʼютер: стоїть нижче, біля низу екрана; телефон — у межах роадмапу
      const y = isWide() ? Math.max(h + 6, seen) : Math.max(h + 6, Math.min(root.offsetHeight - 6, seen));
      cat.style.translate = `${root.offsetWidth - w / 2 - 6}px ${y}px`;
      cat.classList.remove('is-left');
      reveal.style.strokeDashoffset = String(total); // дорога ще не почалась
    };
    const layout = () => {
      stops = roadStops(root);
      svg.setAttribute('viewBox', `0 0 ${root.offsetWidth} ${root.offsetHeight}`);
      const d = smoothPath(stops);
      road.setAttribute('d', d);
      reveal.setAttribute('d', d);
      total = road.getTotalLength();
      reveal.style.strokeDasharray = `${total} ${total}`;
      lens = stops.map((p) => lengthAt(road, total, p));
      pos = lens[catStop(shownNow, stops.length)] ?? 0;
      target = pos;
      if (big) placeBig(); else place(pos);
    };
    const runTo = (l) => {
      if (l === target) return;
      target = l;
      cancelAnimationFrame(anim);
      const from = pos;
      const dur = Math.max(450, Math.abs(l - from) / RUN_SPEED);
      const t0 = performance.now();
      cat.classList.add('is-run');
      let lastX = road.getPointAtLength(from).x;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        pos = from + (l - from) * e;
        const x = road.getPointAtLength(pos).x;
        place(pos, Math.abs(x - lastX) > 0.3 ? x - lastX : 0);
        lastX = x;
        if (k < 1) anim = requestAnimationFrame(step);
        else cat.classList.remove('is-run');
      };
      anim = requestAnimationFrame(step);
    };

    let shownNow = 0;
    let big = true;
    let jump = 0;
    const apply = (n) => {
      shownNow = n;
      art?.classList.toggle('is-started', n > 0);
      items.forEach((el, i) => el.classList.toggle('is-on', i < n));
      finish.classList.toggle('is-done', n === items.length);
      say.dataset.say = n === 0 ? 'start' : n === items.length ? 'done' : '';
      if (n === 0) return;
      const go = () => runTo(lens[catStop(n, stops.length)] ?? 0);
      if (big) {
        // Перша прокрутка: маскот зменшується і стрибає на початок дороги, далі біжить нею
        big = false;
        cat.classList.remove('is-big');
        cat.classList.add('is-jump');
        pos = lens[0] ?? 0;
        target = pos;
        place(pos);
        jump = setTimeout(() => { cat.classList.remove('is-jump'); runTo(lens[catStop(shownNow, stops.length)] ?? 0); }, 650);
        return;
      }
      if (!cat.classList.contains('is-jump')) go();
    };
    layout();
    if (prefersCalm()) { big = false; cat.classList.remove('is-big'); apply(items.length); layout(); return undefined; }
    let raf = 0;
    let shown = 0; // лише росте: вгору роадмап не відмотується
    const update = () => {
      raf = 0;
      const n = Math.max(shown, measureShown(root, items.length));
      if (n !== shown || n === 0) apply(n);
      shown = n;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onResize = () => { cancelAnimationFrame(anim); cat.classList.remove('is-run'); layout(); onScroll(); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(anim);
      clearTimeout(jump);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="s-hero-art">
      <div className="s-roadmap" ref={ref} aria-hidden="true">
        <svg className="s-road">
          <defs>
            <mask id="s-road-mask" maskUnits="userSpaceOnUse">
              <path className="s-road-reveal" />
            </mask>
          </defs>
          <path className="s-road-line" mask="url(#s-road-mask)" />
        </svg>
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
            <span><small>Фініш</small><b>Ваша дитина:</b></span>
          </div>
          <ul className="s-rm-points">
            {FINISH.map((f) => (
              <li key={f.text} data-step className="s-rm-point">
                <span className="s-rm-face">{f.face}</span>{f.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="s-mascot is-big">
          <span className="s-mascot-say" data-say="start"><b className="is-start">Готові? Поїхали!</b></span>
          <Book />
        </div>
      </div>
    </div>
  );
}

function Medal() {
  return (
    <svg className="s-medal" viewBox="0 0 48 48">
      <path d="M15 26 10 44l7-4 4 6 3-14zM33 26l5 18-7-4-4 6-3-14z" fill="#15803d" />
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
