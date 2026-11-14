/* Спільні частини сторінок сайту: заголовки секцій, слайдер, картки курсів, проєктів, відгуків, квитки, заклик. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CourseIcon, themeClass } from '../courseLook.jsx';
import { lessonsWord, money } from '../fmt.js';
import { Button, IconButton } from '../ui.jsx';
import { IconExternal, IconLeft, IconPhone, IconQuote, IconRight } from '../icons.jsx';
import { CTA } from './content.js';
import { prettyPhone, telHref, useLead, useSite } from './ctx.js';
import { coursesWord, homePlans, initials, ticketClass, topicsWord } from './logic.js';
import { prefersCalm, useMedia } from './motion.jsx';

/* ───────── Каркас ───────── */

export function useTitle(title) {
  useEffect(() => { document.title = title ? `${title} — Be Smart School` : 'Be Smart School — школа програмування'; }, [title]);
}

export function SectionHead({ title, to, more, children }) {
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

export function PageHero({ title, lead, children }) {
  return (
    <section className="s-wrap s-page-hero">
      <h1>{title}</h1>
      {lead && <p className="s-lead">{lead}</p>}
      {children}
    </section>
  );
}

/** Горизонтальний слайдер: свайп на телефоні (по одній картці), стрілки в заголовку секції ширше. */
export function SliderSection({ title, to, more, label, children }) {
  const ref = useRef(null);
  const go = (dir) => {
    const el = ref.current;
    const card = el?.firstElementChild;
    if (!card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: dir * (card.getBoundingClientRect().width + gap), behavior: 'smooth' });
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

export function Loading() {
  return <div className="s-wrap s-loading" role="status" aria-label="Завантаження"><i /><i /><i /></div>;
}

export function LoadError({ onRetry }) {
  return (
    <div className="s-wrap s-empty">
      <p>Не вдалося завантажити дані.</p>
      <Button variant="ghost" onClick={onRetry}>Спробувати ще</Button>
    </div>
  );
}

/** Дані сайту ще вантажаться, не завантажились або вже є — спільний шаблон сторінок-списків. */
export function SiteData({ children }) {
  const { data, error, reload } = useSite();
  if (error && !data) return <LoadError onRetry={reload} />;
  if (!data) return <Loading />;
  return children(data);
}

/* ───────── Картки ───────── */

/** Картка «курсу» на сайті — це напрямок: вигляд від першого курсу, під назвою — курси, з яких він складається. */
export function CourseCard({ c }) {
  const lead = useLead();
  const several = c.courses.length > 1;
  return (
    <article className={`s-card s-course ${themeClass(c.theme)}`}>
      <span className="s-course-cover">
        <CourseIcon course={c} size={30} big />
        <span className="s-course-mark" aria-hidden="true"><CourseIcon course={c} size={150} /></span>
        {several
          ? <span className="s-course-count">{coursesWord(c.courses.length)}</span>
          : c.steps > 0 && <span className="s-course-count">{topicsWord(c.steps)}</span>}
      </span>
      <div className="s-course-body">
        <h3><Link to={`/courses/${c.id}`} className="s-course-link">{c.title}</Link></h3>
        {c.summary && <p>{c.summary}</p>}
        {several && <ol className="s-course-parts">{c.courses.map((x, k) => <li key={x.id}><b>{k + 1}</b>{x.title}</li>)}</ol>}
        <div className="s-course-actions">
          <Link to={`/courses/${c.id}`} className="btn btn-ghost">Детальніше</Link>
          <Button onClick={() => lead(`Курс: ${c.title}`)}>Записатись</Button>
        </div>
      </div>
    </article>
  );
}

/** Проєкт учня: скрін (або заглушка в кольорах курсу), назва, автор і курс, посилання на сам проєкт. */
export function ProjectCard({ p }) {
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

export function ReviewCard({ r }) {
  return (
    <figure className="s-card s-review">
      <IconQuote size={28} className="s-review-q" />
      <blockquote>{r.text}</blockquote>
      <figcaption>
        <span className="s-review-ava" aria-hidden="true">{initials(r.author)}</span>
        <span>
          <strong>{r.author}</strong>
          {(r.author_role || r.course_title) && <small>{[r.author_role, r.course_title].filter(Boolean).join(', ')}</small>}
        </span>
      </figcaption>
    </figure>
  );
}

export function PlanTicket({ p }) {
  const lead = useLead();
  return (
    <article className={`ticket s-ticket ${ticketClass(p.color)}`}>
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

/* ───────── Ціни на головній ───────── */

const PLANS_SWAP = 4200; // мс: компʼютер, бокові квитки міняються
const PLANS_STEP = 3200; // мс: телефон, слайдер перескакує
const PLANS_HOLD = 6000; // мс: після дотику автоперемикання чекає

/** Ціни на головній: які квитки показати — homePlans() у logic.js. */
export function HomePlans({ plans }) {
  const wide = useMedia('(min-width: 900px)');
  const five = plans.length >= 5;
  const [alt, setAlt] = useState(false);
  useEffect(() => {
    if (!wide || !five || prefersCalm()) return undefined;
    const t = setInterval(() => setAlt((a) => !a), PLANS_SWAP);
    return () => clearInterval(t);
  }, [wide, five]);

  const shown = homePlans(plans, { wide, alt });
  if (!wide) return <PlanSlider plans={shown} />;
  return (
    <div className={`s-tickets s-plans-row ${five ? 'is-five' : ''}`}>
      {shown.map((pl, k) => <div key={k === 1 ? 'mid' : pl.id} className={`s-plan-slot ${k === 1 && five ? 'is-mid' : ''}`}><PlanTicket p={pl} /></div>)}
    </div>
  );
}

/** Слайдер квитків на телефоні: сам перескакує, гортається пальцем, без кнопок. */
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
    }, PLANS_STEP);
    return () => clearInterval(t);
  }, [plans.length]);
  const hold = () => { pausedUntil.current = Date.now() + PLANS_HOLD; };
  return (
    <div className="s-plan-slider" ref={ref} onTouchStart={hold} onPointerDown={hold} onWheel={hold}>
      {plans.map((pl) => <div key={pl.id} className="s-plan-slide"><PlanTicket p={pl} /></div>)}
    </div>
  );
}

/* ───────── Заклик ───────── */

/** Заклик: «Записатись», роздільник «або», «Зателефонувати». */
export function CtaBand({ title = CTA.title, text = CTA.text, note }) {
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
