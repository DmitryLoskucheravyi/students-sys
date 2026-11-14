/*
 * Сторінки сайту. Частини — у parts.jsx (картки, слайдер, заклик), перший екран — hero.jsx,
 * секції «як навчаємо» — features.jsx, чисті розрахунки — logic.js.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CourseIcon, themeClass } from '../courseLook.jsx';
import { Button } from '../ui.jsx';
import { IconDown, IconLeft, IconPhone, IconRight } from '../icons.jsx';
import { FEATURES, HERO, PAGES, STEPS } from './content.js';
import { telHref, useLead, useSite } from './ctx.js';
import { FeatureArt } from './features.jsx';
import { Bits, HeroArt, TrialPeek } from './hero.jsx';
import { directionMeta, subtopicsWord, topicsWord } from './logic.js';
import { Reveal } from './motion.jsx';
import {
  CourseCard, CtaBand, HomePlans, LoadError, Loading, PageHero, PlanTicket, ProjectCard, ReviewCard,
  SectionHead, SiteData, SliderSection, useTitle,
} from './parts.jsx';

/* ───────── Головна ───────── */

function Hero() {
  const lead = useLead();
  const phone = useSite().data?.contacts?.phone;
  return (
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
          <Link to="/courses" className="btn s-big s-hero-courses">Переглянути курси<IconRight size={18} /></Link>
          <div className="s-hero-actions">
            {phone
              ? <a className="btn btn-onred s-big" href={telHref(phone)}><IconPhone size={20} /><span>Зателефонувати</span></a>
              : <Button className="btn-onred s-big" onClick={() => lead()}>Записатись</Button>}
            <TrialPeek />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Секції «як навчаємо»: номер, заголовок, опис і картки-макети. */
function Story() {
  return (
    <div className="s-story">
      {FEATURES.map((f, i) => (
        <section key={f.title} className={`s-wrap s-chapter ${f.align === 'right' ? 'is-right' : ''}`}>
          <div className="s-chapter-text">
            <Reveal as="p" className="s-chapter-n">{String(i + 1).padStart(2, '0')}</Reveal>
            <Reveal as="h2" className="s-chapter-title">{f.title}</Reveal>
            <Reveal as="p" className="s-chapter-lead" delay={120}>{f.text}</Reveal>
          </div>
          <FeatureArt icon={f.icon} variant={i % 4} />
        </section>
      ))}
    </div>
  );
}

export function Home() {
  useTitle(null);
  const { data, error, reload } = useSite();
  return (
    <>
      <Hero />
      <Story />

      {error && !data && <LoadError onRetry={reload} />}
      {!data && !error && <Loading />}

      {data?.directions?.length > 0 && (
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

      {data?.plans?.length > 0 && (
        <section className="s-wrap s-sec">
          <SectionHead title="Ціни" to="/prices" more="Усі ціни" />
          <HomePlans plans={data.plans} />
        </section>
      )}

      {data?.reviews?.length > 0 && (
        <SliderSection title="Відгуки" to="/reviews" more="Усі відгуки" label="Відгуки">
          {data.reviews.slice(0, 9).map((r) => <ReviewCard key={r.id} r={r} />)}
        </SliderSection>
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

/* ───────── Сторінки-списки ───────── */

/** Сторінка-список: шапка, вміст із даних сайту або порожній стан, заклик. */
function ListPage({ page, cta, list, empty, render }) {
  useTitle(page.title);
  return (
    <>
      <PageHero {...page} />
      <section className="s-wrap s-sec is-tight">
        <SiteData>{(data) => (list(data)?.length ? render(list(data)) : <p className="s-empty">{empty}</p>)}</SiteData>
      </section>
      <CtaBand {...cta} />
    </>
  );
}

export function CoursesPage() {
  return (
    <ListPage page={PAGES.courses} list={(d) => d.directions}
      empty="Список курсів скоро зʼявиться. Залиште заявку — розкажемо, що можемо запропонувати."
      render={(items) => <div className="s-grid">{items.map((c) => <CourseCard key={c.id} c={c} />)}</div>} />
  );
}

export function ProjectsPage() {
  return (
    <ListPage page={PAGES.projects} cta={{ title: 'Хочете так само?' }} list={(d) => d.projects}
      empty="Проєкти учнів скоро зʼявляться тут."
      render={(items) => <div className="s-grid">{items.map((p) => <ProjectCard key={p.id} p={p} />)}</div>} />
  );
}

export function PricesPage() {
  return (
    <ListPage page={PAGES.prices} list={(d) => d.plans}
      empty="Ціни уточнюйте телефоном або залиште заявку — ми зателефонуємо."
      render={(items) => <div className="s-tickets">{items.map((p) => <PlanTicket key={p.id} p={p} />)}</div>} />
  );
}

export function ReviewsPage() {
  return (
    <ListPage page={PAGES.reviews} list={(d) => d.reviews}
      empty="Відгуків тут ще немає."
      render={(items) => <div className="s-masonry">{items.map((r) => <ReviewCard key={r.id} r={r} />)}</div>} />
  );
}

/* ───────── Сторінка курсу (напрямку) ───────── */

/** Програма одного курсу: нумерований шлях зигзагом, підтеми згорнуті. */
function Program({ course, index, total, last }) {
  const several = total > 1;
  return (
    <section className={`s-wrap s-sec s-program-wrap ${themeClass(course.theme)}`}>
      <div className="s-program-side">
        {several && <p className="s-program-part">Курс {index + 1} з {total}</p>}
        <h2>{several ? course.title : 'Програма'}</h2>
        {several && course.summary && <p className="s-program-sum">{course.summary}</p>}
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
                    <summary>{subtopicsWord(s.topics.length)}<IconDown size={16} /></summary>
                    <ul className="s-topics">{s.topics.map((t, k) => <li key={k}>{t}</li>)}</ul>
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

/** Завантажує напрямок; відповідь для попередньої адреси (швидкий перехід між курсами) відкидається. */
function useDirection(id) {
  const [state, setState] = useState({ course: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setState({ course: null, error: null });
    api(`/site/courses/${encodeURIComponent(id)}`)
      .then((course) => { if (current) setState({ course, error: null }); })
      .catch((error) => { if (current) setState({ course: null, error }); });
    return () => { current = false; };
  }, [id, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

/** Сторінка «курсу» на сайті — напрямку: шапка, програми його курсів по черзі, відгуки. */
export function CoursePage() {
  const { id } = useParams();
  const { course, error, retry } = useDirection(id);
  useTitle(course?.title ?? (error ? 'Курс не знайдено' : ''));
  const lead = useLead();

  // 404 — такого курсу немає, 400 — адреса взагалі не схожа на курс: обидва «не знайдено», а не збій
  if (error) return error.status === 404 || error.status === 400 ? <NotFound title="Курс не знайдено" /> : <LoadError onRetry={retry} />;
  if (!course) return <Loading />;
  const withSteps = course.courses.filter((c) => c.steps.length > 0);
  const meta = directionMeta(course);
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
        <SliderSection title="Відгуки про курс" label="Відгуки про курс">
          {course.reviews.map((r) => <ReviewCard key={r.id} r={r} />)}
        </SliderSection>
      )}

      <CtaBand title="Хочете на цей курс?" note={`Курс: ${course.title}`} />
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
