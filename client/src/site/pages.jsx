/* Сторінки сайту і їхні частини: картки курсів, квитки абонементів, відгуки, заклик записатись. */
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CourseIcon, themeClass } from '../courseLook.jsx';
import { lessonsWord, money, plural } from '../fmt.js';
import { Button, IconButton } from '../ui.jsx';
import { IconExternal, IconLeft, IconPhone, IconQuote, IconRight } from '../icons.jsx';
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

function CourseCard({ c }) {
  const lead = useLead();
  return (
    <article className={`s-card s-course ${themeClass(c.theme)}`}>
      <span className="s-course-cover">
        <CourseIcon course={c} size={30} big />
        <span className="s-course-mark" aria-hidden="true"><CourseIcon course={c} size={150} /></span>
        {c.steps > 0 && <span className="s-course-count">{topicsWord(c.steps)}</span>}
      </span>
      <div className="s-course-body">
        <h3><Link to={`/courses/${c.id}`} className="s-course-link">{c.title}</Link></h3>
        {c.summary && <p>{c.summary}</p>}
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

function PlanTicket({ p }) {
  const lead = useLead();
  return (
    <article className={`ticket s-ticket ${tk(p.color)}`}>
      <div className="ticket-main">
        <h3>{p.name}</h3>
        <p className="ticket-count">{lessonsWord(p.lessons_count)}, {p.valid_days} днів</p>
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

const MOCK_TOPICS = [['Змінні й типи', 'done'], ['Умови', 'done'], ['Цикли', 'now'], ['Функції', ''], ['Перший проєкт', '']];

/* Перший екран: живий редактор. Код друкується сам, «запускається», і праворуч зʼявляється результат. */
const PLAY = [
  {
    file: 'star.py', out: 'star',
    code: [['k', 'from'], ['', ' turtle '], ['k', 'import'], ['', ' *\n\n'], ['k', 'for'], ['', ' i '], ['k', 'in'], ['', ' '], ['f', 'range'], ['', '('], ['n', '5'], ['', '):\n    '],
      ['f', 'forward'], ['', '('], ['n', '150'], ['', ')\n    '], ['f', 'right'], ['', '('], ['n', '144'], ['', ')']],
  },
  {
    file: 'hello.py', out: 'hello',
    code: [['', 'name = '], ['f', 'input'], ['', '('], ['s', '"Як тебе звати? "'], ['', ')\n\n'], ['f', 'print'], ['', '('], ['s', '"Привіт, "'], ['', ' + name + '], ['s', '"!"'], ['', ')']],
  },
  {
    file: 'index.html', out: 'button',
    code: [['', '<'], ['t', 'button'], ['', '>Тисни!</'], ['t', 'button'], ['', '>\n\n<'], ['t', 'style'], ['', '>\n  '], ['t', 'button'], ['', ' {\n    '],
      ['a', 'background'], ['', ': '], ['n', 'crimson'], ['', ';\n    '], ['a', 'border-radius'], ['', ': '], ['n', '99px'], ['', ';\n  }\n</'], ['t', 'style'], ['', '>']],
  },
];
const playLength = (ex) => ex.code.reduce((n, [, t]) => n + t.length, 0);
const PLAY_LINES = Math.max(...PLAY.map((ex) => ex.code.map(([, t]) => t).join('').split('\n').length));

function PlayResult({ out }) {
  if (out === 'star') {
    return (
      <svg className="s-run-star" viewBox="0 0 200 200" aria-hidden="true">
        <path d="M100 22 L147 167 L24 77 L176 77 L53 167 Z" pathLength="1" />
        <g className="s-run-turtle"><path d="M0 -9 L7 6 L0 3 L-7 6 Z" /></g>
      </svg>
    );
  }
  if (out === 'hello') {
    return (
      <div className="s-run-term">
        <p><span>Як тебе звати? </span><b className="s-run-typed">Оля</b></p>
        <p className="s-run-line">Привіт, Оля!</p>
      </div>
    );
  }
  return (
    <div className="s-run-btn">
      <span className="s-run-button">Тисни!</span>
      <svg className="s-run-cursor" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 8-6 1.5L10 19z" /></svg>
    </div>
  );
}

function HeroArt() {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [i, setI] = useState(0);
  const ex = PLAY[i];
  const total = playLength(ex);
  const [typed, setTyped] = useState(reduce ? total : 0);
  const ran = typed >= total;
  useEffect(() => {
    if (reduce) return undefined;
    const t = ran
      ? setTimeout(() => { setI((k) => (k + 1) % PLAY.length); setTyped(0); }, 4600)
      : setTimeout(() => setTyped((n) => n + 1), 34);
    return () => clearTimeout(t);
  }, [typed, ran, reduce]);
  const open = (k) => { setI(k); setTyped(reduce ? playLength(PLAY[k]) : 0); };

  let left = typed;
  const shown = ex.code.map(([cls, text], k) => {
    if (left <= 0) return null;
    const part = text.slice(0, left);
    left -= text.length;
    return <u key={k} className={cls}>{part}</u>;
  });

  return (
    <div className="s-hero-art">
      <div className="s-play" role="group" aria-label="Приклад: пишемо код і бачимо результат">
        <div className="s-play-code">
          <div className="s-play-bar">
            <span className="s-play-dots" aria-hidden="true"><i /><i /><i /></span>
            <div className="s-play-tabs">
              {PLAY.map((p, k) => (
                <button key={p.file} type="button" className={k === i ? 'is-on' : ''} aria-pressed={k === i} onClick={() => open(k)}>{p.file}</button>
              ))}
            </div>
            <button type="button" className={`s-play-run ${ran ? 'is-on' : ''}`} onClick={() => setTyped(total)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" /></svg>Запуск
            </button>
          </div>
          <div className="s-play-body" aria-hidden="true">
            <span className="s-play-nums">{Array.from({ length: PLAY_LINES }, (_, k) => <span key={k}>{k + 1}</span>)}</span>
            <code style={{ '--lines': PLAY_LINES }}>{shown}<i className="s-caret" /></code>
          </div>
        </div>
        <div className="s-play-out">
          <div className="s-play-out-head"><span className={`s-play-led ${ran ? 'is-on' : ''}`} />{ran ? 'Працює' : 'Пишемо код'}</div>
          <div className="s-play-stage" aria-hidden="true">
            {ran ? <PlayResult key={`${i}-${typed}`} out={ex.out} /> : <span className="s-play-wait"><i /><i /><i /></span>}
          </div>
        </div>
      </div>
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

function RoadArt() {
  return (
    <div className="s-art-card">
      <div className="s-mock-course"><span className="s-mock-ico">Py</span><span><b>Python. Старт</b><small>Тема 3 з 5</small></span><em>48%</em></div>
      <ol className="s-mock-steps">
        {MOCK_TOPICS.map(([t, st], i) => (
          <li key={t} className={st ? `is-${st}` : ''}>
            <span className="s-mock-dot">{st === 'done' ? <Tick /> : i + 1}</span><span>{t}</span>{st === 'now' && <small>Зараз</small>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function HomeworkArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Домашнє «Цикли»</b><span className="s-art-pill is-ok">Перевірено</span></div>
      <div className="s-art-code"><span><u className="k">for</u> n <u className="k">in</u> <u className="f">range</u>(<u className="n">5</u>):</span><span>    <u className="f">print</u>(n * n)</span></div>
      <div className="s-art-note"><span className="s-art-ava">ОК</span><p>Гарно! Наступного разу спробуй винести це у функцію.</p></div>
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

const FEATURE_ART = { road: RoadArt, check: HomeworkArt, quiz: QuizArt, cabinet: CabinetArt };

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
              <div className="s-hero-actions">
                {phone
                  ? <a className="btn btn-onred s-big" href={telHref(phone)}><IconPhone size={20} /><span>Зателефонувати</span></a>
                  : <Button className="btn-onred s-big" onClick={() => lead()}>Записатись</Button>}
              </div>
            </div>
            <HeroArt />
          </div>
        </div>
      </section>

      <div className="s-story">
        {FEATURES.map((f, i) => {
          const Art = FEATURE_ART[f.icon] ?? RoadArt;
          return (
            <section key={f.title} className="s-wrap s-chapter">
              <div className="s-chapter-text">
                <Reveal as="p" className="s-chapter-n">{String(i + 1).padStart(2, '0')}</Reveal>
                <Reveal as="h2" className="s-chapter-title">{f.title}</Reveal>
                <Reveal as="p" className="s-chapter-lead" delay={120}>{f.text}</Reveal>
                <ul className="s-chapter-points">
                  {f.points.map((pt, k) => <Reveal as="li" key={pt} delay={200 + k * 140}><Tick />{pt}</Reveal>)}
                </ul>
              </div>
              <Reveal className="s-chapter-art" delay={150}><Art /></Reveal>
            </section>
          );
        })}
      </div>

      {error && !data && <LoadError onRetry={reload} />}
      {!data && !error && <Loading />}

      {data?.courses.length > 0 && (
        <SliderSection title="Курси" to="/courses" more="Усі курси" label="Курси">
          {data.courses.map((c) => <CourseCard key={c.id} c={c} />)}
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
          <div className="s-tickets">{data.plans.slice(0, 3).map((p) => <PlanTicket key={p.id} p={p} />)}</div>
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
        {data && (data.courses.length
          ? <div className="s-grid">{data.courses.map((c) => <CourseCard key={c.id} c={c} />)}</div>
          : <p className="s-empty">Список курсів скоро зʼявиться. Залиште заявку — розкажемо, що можемо запропонувати.</p>)}
      </section>
      <CtaBand />
    </>
  );
}

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
            {course.steps.length > 0 && <span className="s-course-hero-meta">{topicsWord(course.steps.length)}</span>}
          </div>
        </div>
        <span className="s-course-hero-mark" aria-hidden="true"><CourseIcon course={course} size={320} /></span>
      </section>

      {course.steps.length > 0 && (
        <section className={`s-wrap s-sec s-program-wrap ${themeClass(course.theme)}`}>
          <div className="s-program-side">
            <h2>Програма</h2>
            <p>{topicsWord(course.steps.length)}</p>
          </div>
          <ol className="s-program">
            {course.steps.map((s, i) => (
              <li key={s.id}>
                <span className="s-program-n">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{s.title}</h3>
                  {s.description && <p>{s.description}</p>}
                  {s.topics.length > 0 && <ul className="s-topics">{s.topics.map((t) => <li key={t}>{t}</li>)}</ul>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

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
