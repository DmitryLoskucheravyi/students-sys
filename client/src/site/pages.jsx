/* Сторінки сайту і їхні частини: картки курсів, квитки абонементів, відгуки, заклик записатись. */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CourseIcon, themeClass } from '../courseLook.jsx';
import { lessonsWord, money, plural } from '../fmt.js';
import { Button, IconButton } from '../ui.jsx';
import { IconDown, IconExternal, IconLeft, IconPhone, IconQuote, IconRight, IconSpark } from '../icons.jsx';
import { CTA, FEATURES, HERO, PAGES, STEPS } from './content.js';
import { prettyPhone, telHref, useLead, useSite } from './ctx.js';

const TK = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink', 'ink'];
const tk = (color) => `tk-${TK.includes(color) ? color : 'red'}`;
const topicsWord = (n) => `${n} ${plural(n, 'тема', 'теми', 'тем')}`;

function useTitle(title) {
  useEffect(() => { document.title = title ? `${title} — Be Smart School` : 'Be Smart School — школа програмування'; }, [title]);
}

/* ───────── Частини ───────── */

function SectionHead({ title, to, more, children }) {
  return (
    <div className="s-sec-head">
      <h2>{title}</h2>
      <div className="s-sec-tools">
        {to && <Link to={to} className="s-more">{more}<IconRight size={18} /></Link>}
        {children}
      </div>
    </div>
  );
}

/** Горизонтальний слайдер: свайп на телефоні, стрілки в заголовку секції. */
function SliderSection({ title, to, more, label, children }) {
  const ref = useRef(null);
  const go = (dir) => {
    const el = ref.current;
    const card = el?.firstElementChild;
    if (!card) return;
    el.scrollBy({ left: dir * (card.getBoundingClientRect().width + 16), behavior: 'smooth' });
  };
  return (
    <section className="s-wrap s-sec">
      <SectionHead title={title} to={to} more={more}>
        <span className="s-slider-nav">
          <IconButton label="Попередні" onClick={() => go(-1)}><IconLeft size={20} /></IconButton>
          <IconButton label="Наступні" onClick={() => go(1)}><IconRight size={20} /></IconButton>
        </span>
      </SectionHead>
      <div className="s-slider" ref={ref} role="region" aria-label={label} tabIndex={0}>{children}</div>
    </section>
  );
}

const coursesWord = (n) => `${n} ${plural(n, 'курс', 'курси', 'курсів')}`;

/** Картка «курсу» на сайті — це напрямок: вигляд від першого курсу, під назвою — курси, з яких він складається. */
function CourseCard({ c }) {
  const lead = useLead();
  return (
    <article className={`s-card s-course ${themeClass(c.theme)}`}>
      <span className="s-course-cover">
        <CourseIcon course={c} size={30} big />
        <span className="s-course-mark" aria-hidden="true"><CourseIcon course={c} size={150} /></span>
        {c.courses.length > 1
          ? <span className="s-course-count">{coursesWord(c.courses.length)}</span>
          : c.steps > 0 && <span className="s-course-count">{topicsWord(c.steps)}</span>}
      </span>
      <div className="s-course-body">
        <h3><Link to={`/courses/${c.id}`} className="s-course-link">{c.title}</Link></h3>
        {c.summary && <p>{c.summary}</p>}
        {c.courses.length > 1 && (
          <ol className="s-course-parts">{c.courses.map((x, k) => <li key={x.id}><b>{k + 1}</b>{x.title}</li>)}</ol>
        )}
        <div className="s-course-actions">
          <Link to={`/courses/${c.id}`} className="btn btn-ghost">Детальніше</Link>
          <Button onClick={() => lead(`Курс: ${c.title}`)}>Записатись</Button>
        </div>
      </div>
    </article>
  );
}

/** Проєкт учня: скрін (або заглушка в кольорах курсу), назва, автор і курс, посилання на сам проєкт. */
function ProjectCard({ p }) {
  return (
    <article className={`s-card s-project ${themeClass(p.course_theme)}`}>
      <div className="s-project-shot">
        {p.image
          ? <img src={`/api/site/images/${p.image}`} alt={`Скрін проєкту «${p.title}»`} loading="lazy" />
          : <span className="s-project-ph" aria-hidden="true">{'</>'}</span>}
      </div>
      <div className="s-project-body">
        <h3>{p.url
          ? <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="s-project-link">{p.title}</a>
          : p.title}</h3>
        {(p.author || p.course_title) && <p className="s-project-by">{[p.author, p.course_title].filter(Boolean).join(', ')}</p>}
        {p.description && <p className="s-project-text">{p.description}</p>}
        {p.url && <span className="s-project-go" aria-hidden="true">Відкрити проєкт<IconExternal size={16} /></span>}
      </div>
    </article>
  );
}

function useMedia(query) {
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
const prefersCalm = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Ціни на головній. Абонементів завжди 5.
 * Телефон: слайдер із 1-го, 3-го й 5-го — по одному, сам перескакує, гортається пальцем, без кнопок.
 * Компʼютер: три в ряд, 3-й завжди посередині, а по боках 1-й і 5-й міняються на 2-й і 4-й.
 */
function HomePlans({ plans }) {
  const wide = useMedia('(min-width: 900px)');
  const five = plans.length >= 5;
  const [alt, setAlt] = useState(false);
  useEffect(() => {
    if (!wide || !five || prefersCalm()) return undefined;
    const t = setInterval(() => setAlt((a) => !a), 4200);
    return () => clearInterval(t);
  }, [wide, five]);

  if (wide) {
    const row = five ? (alt ? [plans[1], plans[2], plans[3]] : [plans[0], plans[2], plans[4]]) : plans.slice(0, 3);
    return (
      <div className={`s-tickets s-plans-row ${five ? 'is-five' : ''}`}>
        {row.map((pl, k) => <div key={k === 1 ? 'mid' : pl.id} className={`s-plan-slot ${k === 1 && five ? 'is-mid' : ''}`}><PlanTicket p={pl} /></div>)}
      </div>
    );
  }
  return <PlanSlider plans={five ? [plans[0], plans[2], plans[4]] : plans.slice(0, 3)} />;
}

function PlanSlider({ plans }) {
  const ref = useRef(null);
  const pausedUntil = useRef(0);
  useEffect(() => {
    if (plans.length < 2 || prefersCalm()) return undefined;
    const t = setInterval(() => {
      const el = ref.current;
      if (!el || Date.now() < pausedUntil.current) return;
      const w = el.clientWidth;
      const next = (Math.round(el.scrollLeft / w) + 1) % plans.length;
      el.scrollTo({ left: next * w, behavior: 'smooth' });
    }, 3200);
    return () => clearInterval(t);
  }, [plans.length]);
  // Гортає пальцем — автоперемикання чекає
  const hold = () => { pausedUntil.current = Date.now() + 6000; };
  return (
    <div className="s-plan-slider" ref={ref} onTouchStart={hold} onPointerDown={hold} onWheel={hold}>
      {plans.map((pl) => <div key={pl.id} className="s-plan-slide"><PlanTicket p={pl} /></div>)}
    </div>
  );
}

function PlanTicket({ p }) {
  const lead = useLead();
  return (
    <article className={`ticket s-ticket ${tk(p.color)}`}>
      <div className="ticket-main">
        <h3>{p.name}</h3>
        <p className="ticket-count">{lessonsWord(p.lessons_count)}</p>
        <p className="s-ticket-per">{money(p.price_per_lesson)} за заняття</p>
      </div>
      <div className="ticket-stub">
        <strong>{money(p.total)}</strong>
        <small>за абонемент</small>
        <button type="button" className="btn btn-onred btn-small" onClick={() => lead(`Абонемент: ${p.name}`)}>Записатись</button>
      </div>
    </article>
  );
}

function ReviewCard({ r }) {
  return (
    <figure className="s-card s-review">
      <IconQuote size={28} className="s-review-q" />
      <blockquote>{r.text}</blockquote>
      <figcaption>
        <span className="s-review-ava" aria-hidden="true">{r.author.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
        <span>
          <strong>{r.author}</strong>
          {(r.author_role || r.course_title) && <small>{[r.author_role, r.course_title].filter(Boolean).join(', ')}</small>}
        </span>
      </figcaption>
    </figure>
  );
}

/** Заклик: «Записатись», роздільник «або», «Зателефонувати». */
function CtaBand({ title = CTA.title, text = CTA.text, note }) {
  const lead = useLead();
  const phone = useSite().data?.contacts?.phone;
  return (
    <section className="s-wrap">
      <div className="s-cta">
        <div className="s-cta-text">
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <div className="s-cta-actions">
          <Button className="btn-onred s-big" onClick={() => lead(note)}>Записатись</Button>
          {phone && (
            <>
              <div className="or-line is-light"><span>або</span></div>
              <a className="btn s-call s-big" href={telHref(phone)}><IconPhone size={20} /><span>{prettyPhone(phone)}</span></a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/*
 * Перший екран: роадмап згори вниз, від новачка до сертифіката. Шлях пунктирний; яскравий пунктир прогресу
 * заповнюється, поки сторінку гортають, і відкочується назад, коли гортають угору. «Ви» їде по шляху,
 * кроки загоряються, на фініші — конфеті. Усе рахується з прокрутки, без React-рендеру на кожен кадр.
 */
const ROAD_W = 500;
const ROAD_H = 660;
const ROAD_PATH = 'M100 52 C 290 40, 420 100, 400 180 S 110 250, 100 340 S 390 420, 400 500 S 300 590, 250 592';
const ROAD = [
  { x: 100, y: 52, label: 'Старт', title: 'Новачок у програмуванні', side: 'r' },
  { x: 400, y: 180, label: 'Крок 1', title: 'Перша програма', side: 'l' },
  { x: 100, y: 340, label: 'Крок 2', title: 'Свій сайт або гра', side: 'r' },
  { x: 400, y: 500, label: 'Крок 3', title: 'Проєкт у команді', side: 'l' },
];
const ROAD_END = { x: 250, y: 612 };
const CONFETTI = [[-110, -70, '#ffd479'], [96, -84, '#fff'], [-150, 6, '#a3e6b0'], [150, -6, '#ffd479'], [-70, -110, '#fff'], [70, -112, '#a7d4ff'], [0, -128, '#ff9aa7'], [-170, -48, '#fff'], [172, -52, '#a3e6b0'], [30, -100, '#ffd479'], [-30, -140, '#a7d4ff'], [124, -120, '#ff9aa7']];

/** Скільки шляху пройдено: на компʼютері — від прокрутки самого хіро, на телефоні — від того, де роадмап на екрані. */
function roadTarget(el) {
  const vh = window.innerHeight;
  if (window.matchMedia('(min-width: 900px)').matches) {
    const hero = el.closest('.s-hero');
    const span = (hero?.offsetHeight ?? vh) * 0.6;
    return window.scrollY / span;
  }
  const r = el.getBoundingClientRect();
  return (vh * 0.5 - r.top) / r.height;
}

function HeroArt() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const path = root.querySelector('.s-road-measure');
    const total = path.getTotalLength();
    // Де на шляху стоїть кожна зупинка: найближча точка
    const stops = ROAD.map((st) => {
      let best = 0;
      let dist = Infinity;
      for (let i = 0; i <= 400; i += 1) {
        const pt = path.getPointAtLength((total * i) / 400);
        const d = (pt.x - st.x) ** 2 + (pt.y - st.y) ** 2;
        if (d < dist) { dist = d; best = i / 400; }
      }
      return best;
    });
    const nodes = [...root.querySelectorAll('[data-stop]')];
    const fill = root.querySelectorAll('.s-road-fill');
    const you = root.querySelector('.s-road-you');
    const calm = prefersCalm();
    let shown = calm ? 1 : 0;
    let target = shown;
    let raf = 0;
    const paint = () => {
      for (const f of fill) f.style.strokeDasharray = `${shown} 1`;
      const pt = path.getPointAtLength(total * Math.min(shown, 0.999));
      you.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      for (const n of nodes) n.classList.toggle('is-on', shown >= (n.dataset.stop === 'end' ? 0.985 : stops[n.dataset.stop] - 0.01));
      root.classList.toggle('is-done', shown >= 0.985);
    };
    const tick = () => {
      shown += (target - shown) * 0.14;
      if (Math.abs(target - shown) < 0.0005) shown = target;
      paint();
      raf = shown === target ? 0 : requestAnimationFrame(tick);
    };
    const onScroll = () => {
      target = Math.min(1, Math.max(0, roadTarget(root)));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    paint();
    if (calm) return undefined;
    onScroll();
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
        <svg viewBox={`0 0 ${ROAD_W} ${ROAD_H}`}>
          <defs>
            <mask id="s-road-mask" maskUnits="userSpaceOnUse" x="-50" y="-50" width={ROAD_W + 100} height={ROAD_H + 100}>
              <path className="s-road-fill" d={ROAD_PATH} pathLength="1" stroke="#fff" strokeWidth="40" fill="none" strokeLinecap="round" />
            </mask>
          </defs>
          <path className="s-road-measure" d={ROAD_PATH} fill="none" stroke="none" />
          <path className="s-road-dash" d={ROAD_PATH} />
          <path className="s-road-glow s-road-fill" d={ROAD_PATH} pathLength="1" />
          <path className="s-road-line" d={ROAD_PATH} mask="url(#s-road-mask)" />
          {ROAD.map((st, k) => (
            <g key={st.title} className="s-road-node" data-stop={k} transform={`translate(${st.x} ${st.y})`}>
              <circle className="s-road-halo" r="26" />
              <circle className="s-road-dot" r="15" />
              <path d="M-6 0l4 4 8-8.500" />
            </g>
          ))}
          <g className="s-road-you" transform={`translate(${ROAD[0].x} ${ROAD[0].y})`}>
            <circle className="s-road-ring" r="20" />
            <circle r="20" />
            <text>Ви</text>
          </g>
        </svg>
        {ROAD.map((st, k) => (
          <div key={st.title} data-stop={k} className={`s-road-card is-${st.side}`} style={{ left: `${(st.x / ROAD_W) * 100}%`, top: `${(st.y / ROAD_H) * 100}%` }}>
            <small>{st.label}</small>{st.title}
          </div>
        ))}
        <div className="s-road-finish" data-stop="end" style={{ left: `${(ROAD_END.x / ROAD_W) * 100}%`, top: `${(ROAD_END.y / ROAD_H) * 100}%` }}>
          <span className="s-confetti">{CONFETTI.map(([x, y, c], k) => <i key={k} style={{ '--x': `${x}px`, '--y': `${y}px`, '--c': c, '--r': `${k * 47}deg`, '--k': k }} />)}</span>
          <svg className="s-medal" viewBox="0 0 48 48">
            <path d="M15 26 10 44l7-4 4 6 3-14zM33 26l5 18-7-4-4 6-3-14z" fill="#d6112b" />
            <circle cx="24" cy="20" r="15" fill="#ffd479" stroke="#e5a91a" strokeWidth="3" />
            <path d="M24 11.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="#fff" />
          </svg>
          <span><small>Фініш</small><b>Маю сертифікат від крутої школи</b></span>
          <span className="s-smile">:)</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Шторка під кнопкою в хіро. Висувається, лише коли кнопку вже видно на екрані (на телефоні — коли доскролили),
 * висить 12 с і ховається. Лише раз за сесію.
 */
const PEEK_HOLD = 12000;
function TrialPeek() {
  const ref = useRef(null);
  const [state, setState] = useState('hidden');
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem('bs.trialPeek') === '1'; } catch { /* приватний режим */ }
    const anchor = ref.current?.parentElement;
    if (seen || !anchor) return undefined;
    const timers = [];
    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      io?.disconnect();
      setState('open');
      try { sessionStorage.setItem('bs.trialPeek', '1'); } catch { /* ок */ }
      timers.push(setTimeout(() => setState('closing'), PEEK_HOLD), setTimeout(() => setState('done'), PEEK_HOLD + 700));
    };
    // Кнопка має повністю потрапити в кадр і пробути там мить — тоді шторка виїжджає на очах
    let wait = null;
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([e]) => {
      clearTimeout(wait);
      if (e.isIntersecting) wait = setTimeout(show, 700);
    }, { threshold: 1 });
    if (io) io.observe(anchor); else show();
    return () => { io?.disconnect(); clearTimeout(wait); timers.forEach(clearTimeout); };
  }, []);
  if (state === 'done') return null;
  return (
    <div ref={ref} className="s-peek-wrap" role="status" hidden={state === 'hidden'}>
      <div className={`s-peek ${state === 'closing' ? 'is-out' : ''}`}><IconSpark size={18} />Перше пробне заняття <b>безкоштовно</b></div>
    </div>
  );
}

/** Зʼявляється, коли доскролили: кожен елемент окремо, тож контент виростає поступово. */
function Reveal({ as: Tag = 'div', className = '', delay = 0, children }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: '0px 0px -15% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`s-reveal ${on ? 'is-in' : ''} ${className}`} style={{ '--d': `${delay}ms` }}>{children}</Tag>;
}

const Tick = () => <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function SoloArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Заняття 1 на 1</b><span className="s-art-pill is-live">Наживо</span></div>
      <div className="s-art-duo">
        <span className="s-art-person"><span className="s-art-ava is-big">ОК</span><small>Викладач</small></span>
        <span className="s-art-link" aria-hidden="true"><i /><i /><i /></span>
        <span className="s-art-person"><span className="s-art-ava is-big is-you">Ви</span><small>Учень</small></span>
      </div>
      <small className="s-art-label">Індивідуальна програма</small>
      <ul className="s-art-tags"><li>Python</li><li>Свої ігри</li><li>Свій темп</li></ul>
      <div className="s-art-row"><small>Наступне заняття</small><small><b>Вт, 17:00</b></small></div>
    </div>
  );
}

function HomeworkArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Домашнє «Цикли»</b><span className="s-art-pill is-ok">Перевірено</span></div>
      <div className="s-art-code"><span><u className="k">for</u> n <u className="k">in</u> <u className="f">range</u>(<u className="n">5</u>):</span><span>    <u className="f">print</u>(n * n)</span></div>
      <div className="s-art-note"><span className="s-art-ava">ОК</span><p>Гарно! Наступного разу спробуйте винести це у функцію.</p></div>
      <div className="s-art-row"><small>Оцінка</small><b className="s-art-grade">11<span>/12</span></b></div>
    </div>
  );
}

function QuizArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><small>Тест «Цикли»</small><small>3 з 10</small></div>
      <b className="s-art-q">Що виведе <code>print(2 ** 3)</code>?</b>
      <ul className="s-art-options">
        <li>6</li>
        <li className="is-right">8<Tick /></li>
        <li>9</li>
      </ul>
      <div className="s-art-row"><small>Результат</small><b className="s-art-grade is-green">9<span>/10</span></b></div>
    </div>
  );
}

function CabinetArt() {
  return (
    <div className="s-art-card">
      <small className="s-art-label">Найближчі заняття</small>
      <ul className="s-art-lessons">
        <li><b>Пн</b><span><em>17:00</em>Python. Старт</span></li>
        <li><b>Ср</b><span><em>17:00</em>Python. Старт</span></li>
        <li><b>Пт</b><span><em>16:00</em>Розбір домашнього</span></li>
      </ul>
      <div className="s-art-row"><small>Абонемент</small><small><b>6</b> з 8 занять</small></div>
      <div className="s-mock-progress"><i style={{ width: '75%' }} /></div>
    </div>
  );
}

function PlanArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Ваша програма</b><span className="s-art-pill is-ok">Індивідуально</span></div>
      <div className="s-art-note"><span className="s-art-ava is-you">Ви</span><p>Хочу робити свої ігри!</p></div>
      <ol className="s-art-plan">
        <li><b>1</b>Основи Python</li>
        <li><b>2</b>Pygame: перша гра</li>
        <li><b>3</b>Своя гра від ідеї до релізу</li>
      </ol>
    </div>
  );
}

function TimeArt() {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Зручний час</b><small>Листопад</small></div>
      <div className="s-art-week">
        {days.map((d, k) => <span key={d} className={k === 1 || k === 4 ? 'is-on' : ''}><small>{d}</small>{k === 1 ? '17:00' : k === 4 ? '15:30' : ''}</span>)}
      </div>
      <div className="s-art-row"><small>Переносимо, якщо треба</small><span className="s-art-pill is-ok">Без штрафів</span></div>
    </div>
  );
}

function TaskArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Нове домашнє</b><span className="s-art-pill is-live">до пт</span></div>
      <p className="s-art-task">Зробіть гру «Вгадай число»: компʼютер загадує, Ви вгадуєте, а програма підказує «більше» чи «менше».</p>
      <div className="s-art-row"><small>Тема «Цикли»</small><span className="s-art-btn">Здати роботу</span></div>
    </div>
  );
}

function StreakArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Домашні за місяць</b><b className="s-art-grade is-green">8<span>/8</span></b></div>
      <div className="s-art-streak">{Array.from({ length: 8 }, (_, k) => <i key={k}><Tick /></i>)}</div>
      <div className="s-art-row"><small>Середня оцінка</small><small><b>10,5</b> з 12</small></div>
    </div>
  );
}

function ResultArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Тест «Умови»</b><b className="s-art-grade is-green">9<span>/10</span></b></div>
      <ul className="s-art-check">
        <li className="is-ok"><Tick />if та else</li>
        <li className="is-ok"><Tick />Порівняння</li>
        <li className="is-again"><span>!</span>Логічні оператори<small>повторити</small></li>
      </ul>
    </div>
  );
}

function Quiz2Art() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><small>Тест «Рядки»</small><small>5 з 10</small></div>
      <b className="s-art-q">Що поверне <code>len("код")</code>?</b>
      <ul className="s-art-options">
        <li className="is-right">3<Tick /></li>
        <li>4</li>
        <li>"код"</li>
      </ul>
    </div>
  );
}

function TicketArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Абонемент</b><span className="s-art-pill is-ok">Активний</span></div>
      <div className="s-art-ticket"><b>6</b><span>занять лишилось<small>з 8</small></span></div>
      <div className="s-mock-progress"><i style={{ width: '75%' }} /></div>
    </div>
  );
}

function GradesArt() {
  const g = [9, 11, 10, 12, 11, 12];
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Оцінки</b><small>останні 6</small></div>
      <div className="s-art-bars">{g.map((v, k) => <span key={k} style={{ '--h': `${(v / 12) * 100}%` }}><b>{v}</b></span>)}</div>
      <div className="s-art-row"><small>Прогрес курсу</small><small><b>64%</b></small></div>
    </div>
  );
}

/** Стопка карток: передня по колу йде назад, наступна виходить уперед. Крутиться, лише коли видно. */
function CardStack({ cards }) {
  const ref = useRef(null);
  const [front, setFront] = useState(0);
  const [run, setRun] = useState(false);
  const [held, setHeld] = useState(false); // обрану вручну картку тримаємо довше
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const io = new IntersectionObserver(([e]) => setRun(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!run) return undefined;
    const t = setTimeout(() => { setHeld(false); setFront((f) => (f + 1) % cards.length); }, held ? 9000 : 3400);
    return () => clearTimeout(t);
  }, [run, front, held, cards.length]);
  return (
    <div className="s-stack" ref={ref}>
      <div className="s-stack-cards">
        {cards.map((Card, k) => {
          const pos = (k - front + cards.length) % cards.length;
          return <div key={k} className="s-stack-item" data-pos={pos} aria-hidden={pos !== 0}><Card /></div>;
        })}
      </div>
      <div className="s-stack-dots">
        {cards.map((_, k) => <button key={k} type="button" className={k === front ? 'is-on' : ''} aria-label={`Картка ${k + 1}`} onClick={() => { setFront(k); setHeld(true); }} />)}
      </div>
    </div>
  );
}

const FEATURE_ART = {
  solo: [SoloArt, PlanArt, TimeArt],
  check: [HomeworkArt, TaskArt, StreakArt],
  quiz: [QuizArt, ResultArt, Quiz2Art],
  cabinet: [CabinetArt, TicketArt, GradesArt],
};

function Bits() {
  return (
    <div className="s-bits" aria-hidden="true">
      {['1', '0', '1', '1', '0', '{ }', '0', '1', '</>', '1'].map((b, i) => (
        <span key={i} style={{ '--i': i, left: `${4 + i * 9.5}%`, top: `${10 + ((i * 37) % 70)}%` }}>{b}</span>
      ))}
    </div>
  );
}

function Loading() {
  return <div className="s-wrap s-loading" role="status" aria-label="Завантаження"><i /><i /><i /></div>;
}

function LoadError({ onRetry }) {
  return (
    <div className="s-wrap s-empty">
      <p>Не вдалося завантажити дані.</p>
      <Button variant="ghost" onClick={onRetry}>Спробувати ще</Button>
    </div>
  );
}

/* ───────── Сторінки ───────── */

export function Home() {
  useTitle(null);
  const lead = useLead();
  const { data, error, reload } = useSite();
  const phone = data?.contacts?.phone;
  return (
    <>
      <section className="s-hero">
        <div className="s-wrap s-hero-in">
          <div className="s-hero-panel">
            <Bits />
            <div className="s-hero-text">
              <ul className="s-chips">{HERO.chips.map((c) => <li key={c} className="s-eyebrow">{c}</li>)}</ul>
              <h1>{HERO.title}</h1>
              <p className="s-lead">{HERO.lead}</p>
            </div>
            <HeroArt />
            <div className="s-hero-actions">
              {phone
                ? <a className="btn btn-onred s-big" href={telHref(phone)}><IconPhone size={20} /><span>Зателефонувати</span></a>
                : <Button className="btn-onred s-big" onClick={() => lead()}>Записатись</Button>}
              <TrialPeek />
            </div>
          </div>
        </div>
      </section>

      <div className="s-story">
        {FEATURES.map((f, i) => {
          const cards = FEATURE_ART[f.icon] ?? FEATURE_ART.solo;
          return (
            <section key={f.title} className={`s-wrap s-chapter ${f.align === 'right' ? 'is-right' : ''}`}>
              <div className="s-chapter-text">
                <Reveal as="p" className="s-chapter-n">{String(i + 1).padStart(2, '0')}</Reveal>
                <Reveal as="h2" className="s-chapter-title">{f.title}</Reveal>
                <Reveal as="p" className="s-chapter-lead" delay={120}>{f.text}</Reveal>
              </div>
              <Reveal className="s-chapter-art" delay={150}><CardStack cards={cards} /></Reveal>
            </section>
          );
        })}
      </div>

      {error && !data && <LoadError onRetry={reload} />}
      {!data && !error && <Loading />}

      {data?.directions.length > 0 && (
        <SliderSection title="Курси" to="/courses" more="Усі курси" label="Курси">
          {data.directions.map((c) => <CourseCard key={c.id} c={c} />)}
        </SliderSection>
      )}

      {data?.projects?.length > 0 && (
        <section className="s-wrap s-sec">
          <SectionHead title="Проєкти учнів" to="/projects" more="Усі проєкти" />
          <div className="s-grid">{data.projects.slice(0, 3).map((p) => <ProjectCard key={p.id} p={p} />)}</div>
        </section>
      )}

      {data?.plans.length > 0 && (
        <section className="s-wrap s-sec">
          <SectionHead title="Ціни" to="/prices" more="Усі ціни" />
          <HomePlans plans={data.plans} />
        </section>
      )}

      {data?.reviews.length > 0 && (
        <section className="s-wrap s-sec">
          <SectionHead title="Відгуки" to="/reviews" more="Усі відгуки" />
          <div className="s-grid">{data.reviews.slice(0, 3).map((r) => <ReviewCard key={r.id} r={r} />)}</div>
        </section>
      )}

      <section className="s-wrap s-sec">
        <SectionHead title="Як почати" />
        <ol className="s-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="s-step-n">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <CtaBand />
    </>
  );
}

function PageHero({ title, lead, children }) {
  return (
    <section className="s-wrap s-page-hero">
      <h1>{title}</h1>
      {lead && <p className="s-lead">{lead}</p>}
      {children}
    </section>
  );
}

export function CoursesPage() {
  useTitle(PAGES.courses.title);
  const { data, error, reload } = useSite();
  return (
    <>
      <PageHero {...PAGES.courses} />
      <section className="s-wrap s-sec is-tight">
        {error && !data && <LoadError onRetry={reload} />}
        {!data && !error && <Loading />}
        {data && (data.directions.length
          ? <div className="s-grid">{data.directions.map((c) => <CourseCard key={c.id} c={c} />)}</div>
          : <p className="s-empty">Список курсів скоро зʼявиться. Залиште заявку — розкажемо, що можемо запропонувати.</p>)}
      </section>
      <CtaBand />
    </>
  );
}

/** Програма одного курсу: нумерований шлях зигзагом, підтеми згорнуті. */
function Program({ course, index, total, last }) {
  return (
    <section className={`s-wrap s-sec s-program-wrap ${themeClass(course.theme)}`}>
      <div className="s-program-side">
        {total > 1 && <p className="s-program-part">Курс {index + 1} з {total}</p>}
        <h2>{total > 1 ? course.title : 'Програма'}</h2>
        {total > 1 && course.summary && <p className="s-program-sum">{course.summary}</p>}
        <p>{topicsWord(course.steps.length)}</p>
      </div>
      <div className="s-program-main">
        <ol className="s-program">
          {course.steps.map((s, i) => (
            <li key={s.id} className={i % 2 ? 'is-r' : 'is-l'}>
              <span className="s-program-n">{String(i + 1).padStart(2, '0')}</span>
              <div className="s-program-card">
                <h3>{s.title}</h3>
                {s.description && <p>{s.description}</p>}
                {s.topics.length > 0 && (
                  <details className="s-topics-box">
                    <summary>{s.topics.length} {plural(s.topics.length, 'підтема', 'підтеми', 'підтем')}<IconDown size={16} /></summary>
                    <ul className="s-topics">{s.topics.map((t) => <li key={t}>{t}</li>)}</ul>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ol>
        {last
          ? <p className="s-program-end"><span>:)</span>Фініш і сертифікат</p>
          : <p className="s-program-end is-next"><span><IconDown size={20} /></span>Далі: курс {index + 2}</p>}
      </div>
    </section>
  );
}

/** Сторінка «курсу» на сайті — напрямку: шапка, програми його курсів по черзі, відгуки. */
export function CoursePage() {
  const { id } = useParams();
  const [state, setState] = useState({ course: null, error: null });
  const load = () => {
    setState({ course: null, error: null });
    api(`/site/courses/${id}`).then((course) => setState({ course, error: null })).catch((error) => setState({ course: null, error }));
  };
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { course, error } = state;
  useTitle(course?.title ?? (error ? 'Курс не знайдено' : ''));
  const lead = useLead();

  if (error) {
    return error.message.includes('не знайдено') ? <NotFound title="Курс не знайдено" /> : <LoadError onRetry={load} />;
  }
  if (!course) return <Loading />;
  const withSteps = course.courses.filter((c) => c.steps.length > 0);
  const meta = [course.courses.length > 1 && coursesWord(course.courses.length), course.steps > 0 && topicsWord(course.steps)].filter(Boolean).join(', ');
  return (
    <>
      <section className={`s-course-hero ${themeClass(course.theme)}`}>
        <div className="s-wrap s-course-hero-in">
          <Link to="/courses" className="s-back"><IconLeft size={18} />Усі курси</Link>
          <CourseIcon course={course} size={34} big />
          <h1>{course.title}</h1>
          {course.summary && <p className="s-lead">{course.summary}</p>}
          <div className="s-course-hero-actions">
            <Button className="btn-onred s-big" onClick={() => lead(`Курс: ${course.title}`)}>Записатись на курс</Button>
            {meta && <span className="s-course-hero-meta">{meta}</span>}
          </div>
        </div>
        <span className="s-course-hero-mark" aria-hidden="true"><CourseIcon course={course} size={320} /></span>
      </section>

      {withSteps.map((c, k) => <Program key={c.id} course={c} index={k} total={withSteps.length} last={k === withSteps.length - 1} />)}

      {course.reviews.length > 0 && (
        <section className="s-wrap s-sec">
          <SectionHead title="Відгуки про курс" />
          <div className="s-grid">{course.reviews.map((r) => <ReviewCard key={r.id} r={r} />)}</div>
        </section>
      )}

      <CtaBand title="Хочете на цей курс?" note={`Курс: ${course.title}`} />
    </>
  );
}

export function ProjectsPage() {
  useTitle(PAGES.projects.title);
  const { data, error, reload } = useSite();
  return (
    <>
      <PageHero {...PAGES.projects} />
      <section className="s-wrap s-sec is-tight">
        {error && !data && <LoadError onRetry={reload} />}
        {!data && !error && <Loading />}
        {data && (data.projects?.length
          ? <div className="s-grid">{data.projects.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
          : <p className="s-empty">Проєкти учнів скоро зʼявляться тут.</p>)}
      </section>
      <CtaBand title="Хочете так само?" />
    </>
  );
}

export function PricesPage() {
  useTitle(PAGES.prices.title);
  const { data, error, reload } = useSite();
  return (
    <>
      <PageHero {...PAGES.prices} />
      <section className="s-wrap s-sec is-tight">
        {error && !data && <LoadError onRetry={reload} />}
        {!data && !error && <Loading />}
        {data && (data.plans.length
          ? <div className="s-tickets">{data.plans.map((p) => <PlanTicket key={p.id} p={p} />)}</div>
          : <p className="s-empty">Ціни уточнюйте телефоном або залиште заявку — ми зателефонуємо.</p>)}
      </section>
      <CtaBand />
    </>
  );
}

export function ReviewsPage() {
  useTitle(PAGES.reviews.title);
  const { data, error, reload } = useSite();
  return (
    <>
      <PageHero {...PAGES.reviews} />
      <section className="s-wrap s-sec is-tight">
        {error && !data && <LoadError onRetry={reload} />}
        {!data && !error && <Loading />}
        {data && (data.reviews.length
          ? <div className="s-masonry">{data.reviews.map((r) => <ReviewCard key={r.id} r={r} />)}</div>
          : <p className="s-empty">Відгуків тут ще немає.</p>)}
      </section>
      <CtaBand />
    </>
  );
}

export function NotFound({ title = 'Сторінку не знайдено' }) {
  useTitle(title);
  return (
    <section className="s-wrap s-notfound">
      <p className="s-404" aria-hidden="true">404</p>
      <h1>{title}</h1>
      <Link to="/" className="btn btn-primary s-big">На головну</Link>
    </section>
  );
}
