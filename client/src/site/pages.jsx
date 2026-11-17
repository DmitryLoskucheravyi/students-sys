/*
 * Сторінки сайту. Частини — у parts.jsx (картки, слайдер, заклик), перший екран — hero.jsx,
 * секції «як навчаємо» — features.jsx, чисті розрахунки — logic.js.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { CourseIcon, themeClass } from '../courseLook.jsx';
import { Button } from '../ui.jsx';
import { IconDown, IconPeople, IconPhone, IconRight, IconTick, IconUser } from '../icons.jsx';
import { FEATURES, FORMAT, HERO, PAGES, STEPS } from './content.js';
import { telHref, useBoot, useLead, useSite } from './ctx.js';
import { FeatureArt } from './features.jsx';
import { Bits, HeroArt, TrialPeek } from './hero.jsx';
import { directionMeta, subtopicsWord, topicsWord } from './logic.js';
import { Reveal } from './motion.jsx';
import {
  SCHOOL, coursesMeta, courseDescription, courseMeta, directionSlug, faqItems, faqMeta, findDirection, homeMeta,
  notFoundMeta, priceFacts, pricesMeta, privacyMeta, projectsMeta, reviewsMeta,
} from './seo.js';
import {
  CourseCard, CtaBand, DirectionIcon, HomePlans, LoadError, Loading, PageHero, PlanTicket, ProjectCard, ReviewCard,
  SectionHead, SiteData, SliderSection, siteImage, useSeo,
} from './parts.jsx';

/* ───────── Головна ───────── */

/** Заголовок хіро: «→» стає «таблеткою» кольору акценту з товстою стрілкою. Для читачів екрана — слово. */
function HeroTitle({ text }) {
  const [from, to] = text.split('→');
  if (to === undefined) return text;
  return (
    <>
      {from.trim()}{' '}
      <span className="s-arrow">
        <svg viewBox="0 0 48 24" aria-hidden="true"><path d="M8 12h28m-9-8 9 8-9 8" /></svg>
        <span className="sr-only">стає</span>
      </span>
      {' '}{to.trim()}
    </>
  );
}

function Hero() {
  const lead = useLead();
  const phone = useSite().data?.contacts?.phone;
  return (
    <section className="s-hero">
      <div className="s-wrap s-hero-in">
        <div className="s-hero-panel">
          <Bits />
          <div className="s-hero-text">
            <p className="s-chips">{HERO.chips.map((c, k) => <span key={c} className="s-eyebrow">{c}{k < HERO.chips.length - 1 ? ' ' : ''}</span>)}</p>
            <h1 className="s-hero-title"><HeroTitle text={HERO.title} /></h1>
            <p className="s-lead">{HERO.lead}</p>
          </div>
          <HeroArt />
          {/* Обгортка важить лише на планшеті (дві кнопки рядом, прилиплі до низу); деінде — display: contents */}
          <div className="s-hero-cta">
            <Link to="/courses" className="btn s-big s-hero-courses">Переглянути курси<IconRight size={18} /></Link>
            <div className="s-hero-actions">
              {phone
                ? <a className="btn btn-onred s-big" href={telHref(phone)}><IconPhone size={20} /><span>Зателефонувати</span></a>
                : <Button className="btn-onred s-big" onClick={() => lead()}>Записатись</Button>}
              <TrialPeek />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Заголовок-композиція: два рядки, а слово між ними — повернуте набік праворуч, на їхню висоту. */
/** Заголовок з одним виділеним словом: те саме слово, інший колір і шрифт. */
function Accented({ text, word }) {
  const at = word ? text.indexOf(word) : -1;
  if (at < 0) return text;
  return <>{text.slice(0, at)}<em className="s-title-accent">{word}</em>{text.slice(at + word.length)}</>;
}

const FORMAT_ICON = { solo: IconUser, group: IconPeople };

/** Секція «Формат навчання»: досвід викладачів, цифри, два формати й запис. */
function FormatChapter({ n }) {
  const lead = useLead();
  return (
    <section className="s-wrap s-chapter s-format">
      <Reveal as="p" className="s-format-eyebrow">{String(n).padStart(2, '0')} — {FORMAT.label}</Reveal>
      <Reveal as="h2" className="s-format-title">{FORMAT.title}</Reveal>
      <Reveal as="ul" className="s-format-stats" delay={120}>
        {FORMAT.stats.map(([big, small]) => <li key={small}><b>{big}</b><span>{small}</span></li>)}
      </Reveal>
      <Reveal className="s-format-ways" delay={220}>
        {FORMAT.ways.map((w) => {
          const Icon = FORMAT_ICON[w.icon];
          return (
            <article key={w.title} className="s-format-way">
              <span className="s-format-ico"><Icon size={24} /></span>
              <h3>{w.title}</h3>
              <ul>{w.points.map((t) => <li key={t}><IconTick size={16} />{t}</li>)}</ul>
            </article>
          );
        })}
        <div className="s-format-cta">
          <p>Не знаєте, що обрати? Підкажемо на пробному занятті.</p>
          <Button className="s-format-btn" onClick={() => lead()} icon={<IconRight size={18} />}>Записатися</Button>
        </div>
      </Reveal>
    </section>
  );
}

/** Секції «як навчаємо»: номер, заголовок, опис і картки-макети. */
function Story() {
  return (
    <div className="s-story">
      {FEATURES.map((f, i) => (f.icon === 'solo' ? <FormatChapter key={f.title} n={i + 1} /> : (
        <section key={f.title} className={`s-wrap s-chapter ${f.align === 'right' ? 'is-right' : ''}`}>
          <div className="s-chapter-text">
            <Reveal as="p" className="s-chapter-n">{String(i + 1).padStart(2, '0')}</Reveal>
            <Reveal as="h2" className="s-chapter-title"><Accented text={f.title} word={f.accent} /></Reveal>
            <Reveal as="p" className="s-chapter-lead" delay={120}>{f.text}</Reveal>
          </div>
          <FeatureArt icon={f.icon} variant={i % 4} />
        </section>
      )))}
    </div>
  );
}

/** Питання й відповіді: нативні <details>, тож увесь текст є в HTML і без JavaScript. */
function FaqList({ items }) {
  return (
    <div className="s-faq">
      {items.map(({ q, a }, k) => (
        <details key={q} open={k === 0}>
          <summary><h3>{q}</h3><IconDown size={20} /></summary>
          <p className="s-faq-a">{a}</p>
        </details>
      ))}
    </div>
  );
}

export function Home() {
  const { data, error, reload } = useSite();
  useSeo(homeMeta(data));
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

      {data?.plans?.length > 0 && (
        <section className="s-wrap s-sec">
          <SectionHead title="Ціни" to="/prices" more="Усі ціни" />
          <HomePlans plans={data.plans} />
        </section>
      )}

      <section className="s-wrap s-sec">
        <SectionHead title="Часті питання" to="/faq" more="Усі питання" />
        <FaqList items={faqItems(data).slice(0, 4)} />
      </section>

      {data?.projects?.length > 0 && (
        <section className="s-wrap s-sec">
          <SectionHead title="Проєкти учнів" to="/projects" more="Усі проєкти" />
          <div className="s-grid">{data.projects.slice(0, 3).map((p) => <ProjectCard key={p.id} p={p} />)}</div>
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
function ListPage({ page, meta, cta, list, empty, render }) {
  const { data } = useSite();
  useSeo(meta(data));
  return (
    <>
      <PageHero title={page.title} lead={typeof page.lead === 'function' ? page.lead(data) : page.lead} />
      <section className="s-wrap s-sec is-tight">
        <SiteData>{(data) => (list(data)?.length ? render(list(data)) : <p className="s-empty">{empty}</p>)}</SiteData>
      </section>
      <CtaBand {...cta} />
    </>
  );
}

export function CoursesPage() {
  return (
    <ListPage page={PAGES.courses} meta={coursesMeta} list={(d) => d.directions}
      empty="Список курсів скоро зʼявиться. Залиште заявку — розкажемо, що можемо запропонувати."
      render={(items) => <div className="s-grid">{items.map((c) => <CourseCard key={c.id} c={c} />)}</div>} />
  );
}

export function ProjectsPage() {
  return (
    <ListPage page={PAGES.projects} meta={projectsMeta} cta={{ title: 'Хочете так само?' }} list={(d) => d.projects}
      empty="Проєкти учнів скоро зʼявляться тут."
      render={(items) => <div className="s-grid">{items.map((p) => <ProjectCard key={p.id} p={p} />)}</div>} />
  );
}

/** Вступ сторінки цін: першим реченням — сама ціна з кабінету. */
function pricesLead(data) {
  const price = priceFacts(data?.plans);
  return price ? `Онлайн-заняття з програмування — від ${price.minText} за заняття в абонементі, одне заняття — ${price.maxText}. ${PAGES.prices.lead}` : PAGES.prices.lead;
}

export function PricesPage() {
  return (
    <ListPage page={{ ...PAGES.prices, lead: pricesLead }} meta={pricesMeta} list={(d) => d.plans}
      empty="Ціни уточнюйте телефоном або залиште заявку — ми зателефонуємо."
      render={(items) => <div className="s-tickets">{items.map((p) => <PlanTicket key={p.id} p={p} />)}</div>} />
  );
}

export function ReviewsPage() {
  return (
    <ListPage page={PAGES.reviews} meta={reviewsMeta} list={(d) => d.reviews}
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

const sameCourse = (course, id) => course != null && id != null && String(course.id) === String(id);

/**
 * Завантажує напрямок; відповідь для попередньої адреси (швидкий перехід між курсами) відкидається.
 * initial — курс, з яким сторінку зібрано: його видно одразу, а свіжі дані тихо підтягуються з API.
 */
function useDirection(id, initial) {
  const [state, setState] = useState(() => ({ course: sameCourse(initial, id) ? initial : null, error: null, id }));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (id == null) return undefined;
    let current = true;
    setState((s) => (sameCourse(s.course, id) ? s : { course: null, error: null, id }));
    api(`/site/courses/${encodeURIComponent(id)}`)
      .then((course) => { if (current) setState({ course, error: null, id }); })
      // Оновлення не вдалося, а курс уже показано — лишаємо його
      .catch((error) => { if (current) setState((s) => (sameCourse(s.course, id) ? s : { course: null, error, id })); });
    return () => { current = false; };
  }, [id, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // Стан для попередньої адреси не показуємо, поки не прийде відповідь для нової
  return state.id === id ? { course: state.course, error: state.error, retry } : { course: null, error: null, retry };
}

/**
 * Сторінка «курсу» на сайті — напрямку. Адреса — /courses/<slug з назви>; старі числові адреси /courses/3
 * переходять на slug. Прихований напрямок відповідає «не знайдено».
 */
export function CoursePage() {
  const { slug } = useParams();
  const { data, error: siteError, reload } = useSite();
  const boot = useBoot();
  const navigate = useNavigate();
  const dirs = data?.directions;
  const found = dirs ? findDirection(dirs, slug) : undefined;
  const id = !dirs ? null : found ? found.id : /^\d+$/.test(slug) ? Number(slug) : null;
  const { course, error, retry } = useDirection(id, boot.course);
  const canonical = found ? directionSlug(found, dirs) : null;

  useEffect(() => {
    if (canonical && canonical !== slug) navigate(`/courses/${canonical}`, { replace: true });
  }, [canonical, slug, navigate]);

  if (!dirs) return siteError ? <LoadError onRetry={reload} /> : <Loading />;
  if (id == null) return <NotFound title="Курс не знайдено" />;
  // 404 — такого курсу немає, 400 — адреса взагалі не схожа на курс: обидва «не знайдено», а не збій
  if (error) return error.status === 404 || error.status === 400 ? <NotFound title="Курс не знайдено" /> : <LoadError onRetry={retry} />;
  if (!course) return <Loading />;
  return <CourseView course={course} />;
}

/** Курс: крихти, шапка, програми його курсів по черзі, відгуки, інші курси. */
function CourseView({ course }) {
  const { data } = useSite();
  useSeo(courseMeta(course, data));
  const lead = useLead();
  const withSteps = course.courses.filter((c) => c.steps.length > 0);
  const meta = directionMeta(course);
  const others = (data?.directions ?? []).filter((d) => d.id !== course.id).slice(0, 3);
  return (
    <>
      <section className={`s-course-hero ${themeClass(course.theme)}`}>
        <div className="s-wrap s-course-hero-in">
          <nav className="s-crumbs" aria-label="Хлібні крихти">
            <ol>
              <li><Link to="/">Головна</Link></li>
              <li><Link to="/courses">Курси</Link></li>
              <li aria-current="page">{course.title}</li>
            </ol>
          </nav>
          <DirectionIcon d={course} size={34} />
          <h1>{course.title}{' '}<span className="s-h1-sub">онлайн-курс для дітей і підлітків</span></h1>
          <p className="s-lead">{courseDescription(course)}</p>
          <div className="s-course-hero-actions">
            <Button className="btn-onred s-big" onClick={() => lead(`Курс: ${course.title}`)}>Записатись на курс</Button>
            {meta && <span className="s-course-hero-meta">{meta}</span>}
          </div>
        </div>
        <span className="s-course-hero-mark" aria-hidden="true">{course.icon_image ? <img src={siteImage(course.icon_image)} alt="" /> : <CourseIcon course={course} size={320} />}</span>
      </section>

      {withSteps.map((c, k) => <Program key={c.id} course={c} index={k} total={withSteps.length} last={k === withSteps.length - 1} />)}

      {course.reviews.length > 0 && (
        <SliderSection title="Відгуки про курс" label="Відгуки про курс">
          {course.reviews.map((r) => <ReviewCard key={r.id} r={r} />)}
        </SliderSection>
      )}

      {others.length > 0 && (
        <SliderSection title="Інші курси" to="/courses" more="Усі курси" label="Інші курси">
          {others.map((c) => <CourseCard key={c.id} c={c} />)}
        </SliderSection>
      )}

      <CtaBand title="Хочете на цей курс?" note={`Курс: ${course.title}`} />
    </>
  );
}

/* ───────── Питання й відповіді, політика ───────── */

export function FaqPage() {
  const { data } = useSite();
  useSeo(faqMeta(data));
  return (
    <>
      <PageHero title={PAGES.faq.title} lead={PAGES.faq.lead} />
      <section className="s-wrap s-sec is-tight">
        <FaqList items={faqItems(data)} />
      </section>
      <CtaBand title="Не знайшли відповіді?" text="Залиште заявку — ми зателефонуємо й відповімо на всі питання." />
    </>
  );
}

/**
 * Політика конфіденційності: що збирає форма заявки і як із цим поводимося.
 * Описує те, як справді працює система (server/modules/site): правте разом зі змінами в коді.
 */
export function PrivacyPage() {
  useSeo(privacyMeta());
  const c = useSite().data?.contacts ?? {};
  const contact = [c.phone && <a key="p" href={telHref(c.phone)}>{c.phone}</a>, c.email && <a key="e" href={`mailto:${c.email}`}>{c.email}</a>].filter(Boolean);
  return (
    <>
      <PageHero title={PAGES.privacy.title} />
      <section className="s-wrap s-sec is-tight">
        <div className="s-doc">
          <p>Ця політика пояснює, які персональні дані {SCHOOL} отримує через сайт, навіщо і як їх захищає. Ми діємо відповідно до Закону України «Про захист персональних даних».</p>
          <h2>Які дані ми збираємо</h2>
          <ul>
            <li>Ім'я і номер телефону, які ви вказуєте у формі заявки.</li>
            <li>Текст із поля «Додатково», якщо ви його заповнили.</li>
          </ul>
          <p>Дані надає дорослий: батьки або інший законний представник дитини. Ми не просимо у формі прізвище, фото чи документи дитини.</p>
          <h2>Навіщо</h2>
          <p>Лише щоб зв'язатися з вами щодо навчання: розповісти про курси, записати на пробне заняття і підібрати час. Ми не продаємо ваші дані і не передаємо їх для реклами.</p>
          <h2>Де зберігаються і хто їх бачить</h2>
          <p>Заявка зберігається в захищеній базі даних школи, і її бачить лише менеджер школи. Вона також може надходити менеджеру в службовий чат Telegram. Сайт працює на хмарних сервісах (хостинг і база даних), які обробляють дані лише для роботи сайту.</p>
          <h2>Як довго</h2>
          <p>Доки заявка потрібна, щоб домовитися про навчання, або доки ви не попросите її видалити.</p>
          <h2>Cookies</h2>
          <p>Сайт школи не використовує рекламних і аналітичних cookies. Кабінет учня зберігає лише технічний cookie входу, без якого кабінет не працює.</p>
          <h2>Ваші права</h2>
          <p>Ви можете дізнатися, які ваші дані ми зберігаємо, виправити їх або попросити видалити.{contact.length > 0 && <> Напишіть або зателефонуйте нам: {contact.flatMap((el, k) => (k ? [', ', el] : [el]))}.</>}</p>
        </div>
      </section>
    </>
  );
}

export function NotFound({ title = 'Сторінку не знайдено' }) {
  useSeo(notFoundMeta(title));
  return (
    <section className="s-wrap s-notfound">
      <p className="s-404" aria-hidden="true">404</p>
      <h1>{title}</h1>
      <Link to="/" className="btn btn-primary s-big">На головну</Link>
      <nav className="s-notfound-links" aria-label="Корисні сторінки">
        <Link to="/courses">Курси</Link>
        <Link to="/prices">Ціни</Link>
        <Link to="/faq">Питання й відповіді</Link>
      </nav>
    </section>
  );
}
