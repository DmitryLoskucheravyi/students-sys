/* Сторінки сайту і їхні частини: картки курсів, квитки абонементів, відгуки, заклик записатись. */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CourseIcon, themeClass } from '../courseLook.jsx';
import { lessonsWord, money, plural } from '../fmt.js';
import { Button } from '../ui.jsx';
import { IconExternal, IconHomework, IconPhone, IconQuiz, IconQuote, IconRight, IconRoadmap, IconUser } from '../icons.jsx';
import { CTA, FEATURES, HERO, PAGES, STEPS } from './content.js';
import { prettyPhone, telHref, useLead, useSite } from './ctx.js';

const FEATURE_ICON = { road: IconRoadmap, check: IconHomework, quiz: IconQuiz, cabinet: IconUser };
const TK = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink', 'ink'];
const tk = (color) => `tk-${TK.includes(color) ? color : 'red'}`;
const topicsWord = (n) => `${n} ${plural(n, 'тема', 'теми', 'тем')}`;

function useTitle(title) {
  useEffect(() => { document.title = title ? `${title} — Be Smart School` : 'Be Smart School — школа програмування'; }, [title]);
}

/* ───────── Частини ───────── */

function SectionHead({ title, to, more }) {
  return (
    <div className="s-sec-head">
      <h2>{title}</h2>
      {to && <Link to={to} className="s-more">{more}<IconRight size={18} /></Link>}
    </div>
  );
}

function CourseCard({ c }) {
  return (
    <Link to={`/courses/${c.id}`} className={`s-card s-course ${themeClass(c.theme)}`}>
      <CourseIcon course={c} size={30} big />
      <h3>{c.title}</h3>
      {c.summary && <p>{c.summary}</p>}
      <span className="s-course-foot">
        {c.steps > 0 && <span className="s-chip">{topicsWord(c.steps)}</span>}
        <span className="s-course-go" aria-hidden="true"><IconRight size={18} /></span>
      </span>
    </Link>
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
        {(p.author || p.course_title) && <p className="s-project-by">{[p.author, p.course_title].filter(Boolean).join(' · ')}</p>}
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
        <p className="ticket-count">{lessonsWord(p.lessons_count)}<span aria-hidden="true">·</span>{p.valid_days} днів</p>
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
          {(r.author_role || r.course_title) && <small>{[r.author_role, r.course_title].filter(Boolean).join(' · ')}</small>}
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

/** Ілюстрація першого екрана: вікно кабінету з роадмапом курсу, результат тесту й шматок коду. Декор. */
const MOCK_TOPICS = [['Змінні й типи', 'done'], ['Умови', 'done'], ['Цикли', 'now'], ['Функції', ''], ['Перший проєкт', '']];

function HeroArt() {
  return (
    <div className="s-hero-art" aria-hidden="true">
      <div className="s-stage">
        <div className="s-mock">
          <div className="s-mock-bar"><i /><i /><i /><span>Кабінет учня</span></div>
          <div className="s-mock-body">
            <div className="s-mock-course">
              <span className="s-mock-ico">Py</span>
              <span><b>Python. Старт</b><small>Тема 3 з 5</small></span>
              <em>48%</em>
            </div>
            <div className="s-mock-progress"><i /></div>
            <ol className="s-mock-steps">
              {MOCK_TOPICS.map(([t, st], i) => (
                <li key={t} className={st ? `is-${st}` : ''} style={{ '--i': i }}>
                  <span className="s-mock-dot">{st === 'done'
                    ? <svg viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    : i + 1}</span>
                  <span>{t}</span>
                  {st === 'now' && <small>Зараз</small>}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="s-tile s-tile-score">
          <small>Тест · Цикли</small>
          <b>9<span>/10</span></b>
          <i className="s-tile-meter">{Array.from({ length: 10 }, (_, k) => <em key={k} className={k < 9 ? 'is-on' : ''} />)}</i>
        </div>
        <div className="s-tile s-code">
          <span className="s-code-line"><span>1</span><span><u className="k">for</u> i <u className="k">in</u> <u className="f">range</u>(<u className="n">3</u>):</span></span>
          <span className="s-code-line"><span>2</span><span>    <u className="f">print</u>(<u className="s">"Привіт!"</u>, i)</span></span>
          <span className="s-code-line"><span>3</span><span><i className="s-caret" /></span></span>
        </div>
      </div>
    </div>
  );
}

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
              <p className="s-eyebrow">{HERO.eyebrow}</p>
              <h1>{HERO.title}</h1>
              <p className="s-lead">{HERO.lead}</p>
              <div className="s-hero-actions">
                <Button className="btn-onred s-big" onClick={() => lead()}>Записатись</Button>
                {phone
                  ? <a className="btn s-call s-big" href={telHref(phone)}><IconPhone size={20} /><span>Зателефонувати</span></a>
                  : <Link className="btn s-call s-big" to="/courses"><span>Курси</span><IconRight size={20} /></Link>}
              </div>
            </div>
            <HeroArt />
          </div>
        </div>
      </section>

      <section className="s-wrap s-sec">
        <ul className="s-features">
          {FEATURES.map((f, i) => {
            const Icon = FEATURE_ICON[f.icon] ?? IconRoadmap;
            return (
              <li key={f.title} className="s-card s-feature" style={{ '--i': i }}>
                <span className="s-feature-ico"><Icon size={26} /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {error && !data && <LoadError onRetry={reload} />}
      {!data && !error && <Loading />}

      {data?.courses.length > 0 && (
        <section className="s-wrap s-sec">
          <SectionHead title="Курси" to="/courses" more="Усі курси" />
          <div className="s-grid">{data.courses.slice(0, 3).map((c) => <CourseCard key={c.id} c={c} />)}</div>
        </section>
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
      <section className="s-wrap">
        <div className={`s-course-hero ${themeClass(course.theme)}`}>
          <Link to="/courses" className="s-back">← Усі курси</Link>
          <CourseIcon course={course} size={40} big />
          <h1>{course.title}</h1>
          {course.summary && <p className="s-lead">{course.summary}</p>}
          <div className="s-course-hero-actions">
            <Button className="s-big" onClick={() => lead(`Курс: ${course.title}`)}>Записатись на курс</Button>
            {course.steps.length > 0 && <span className="s-chip">{topicsWord(course.steps.length)}</span>}
          </div>
        </div>
      </section>

      {course.steps.length > 0 && (
        <section className="s-wrap s-sec">
          <SectionHead title="Програма" />
          <ol className={`s-program ${themeClass(course.theme)}`}>
            {course.steps.map((s, i) => (
              <li key={s.id} style={{ '--i': Math.min(i, 12) }}>
                <span className="s-program-n">{i + 1}</span>
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
