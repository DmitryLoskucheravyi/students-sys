/*
 * SEO сайту школи: адреси курсів, title/description, структуровані дані (JSON-LD), robots, sitemap, llms.txt.
 * Чисті функції без React і DOM: їх використовують і сторінки в браузері, і збірка (scripts/prerender.mjs).
 * Покриті тестами в tests/unit/seo.test.js.
 */

import { topicsWord } from './logic.js';

/** Основна адреса сайту. Для іншого домену: змінна VITE_SITE_URL під час збірки. */
export const SITE_URL = String(import.meta.env?.VITE_SITE_URL || 'https://besmart-edu.vercel.app').replace(/\/+$/, '');
export const SCHOOL = 'Be Smart School';
/** Одна назва й один опис школи всюди: сайт, соцмережі, каталоги. Так пошуковики й ШІ впізнають школу як одну сутність. */
export const SCHOOL_TAGLINE = 'Онлайн-школа програмування для дітей і підлітків';
export const SCHOOL_ABOUT = 'Be Smart School — онлайн-школа програмування для дітей і підлітків від 6 років. '
  + 'Заняття наживо з викладачем, індивідуально або в групі до 6 учнів, домашні завдання з перевіркою і кабінет, де батьки бачать прогрес.';
export const OG_IMAGE = '/og.png';
/** Ключ IndexNow (Bing та інші): публічний за задумом, лежить у корені сайту як /<ключ>.txt. */
export const INDEXNOW_KEY = 'd453b0d69f915c0595a4234cd6cab795';

export const abs = (path = '/') => `${SITE_URL}${path === '/' ? '/' : path}`;

/* ───────── Адреси курсів ───────── */

// Транслітерація за постановою КМУ № 55 (2010): «Житомир» → zhytomyr, «Їжак» → yizhak.
const TR = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
  ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ё: 'io', ъ: '', "'": '', '’': '', 'ʼ': '',
};
// На початку слова: є → ye, ї → yi, й → y, ю → yu, я → ya.
const TR_START = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' };

/** «Python для дітей» → «python-dlia-ditei». Лише латиниця, цифри й дефіси. */
export function slugify(text) {
  const src = String(text ?? '').toLowerCase().replace(/зг/g, 'zgh').replace(/\+/g, ' plus ').replace(/#/g, ' sharp ').replace(/&/g, ' ');
  let out = '';
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    const start = i === 0 || !/[\p{L}'’ʼ]/u.test(src[i - 1]);
    out += (start ? TR_START[ch] : undefined) ?? TR[ch] ?? ch;
  }
  return out.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
}

/**
 * Адреса курсу (напрямку) на сайті: /courses/<slug з назви>. Якщо slug порожній або зайнятий іншим напрямком
 * з меншим id — додається id. all — усі опубліковані напрямки (для перевірки збігів).
 */
export function directionSlug(d, all = []) {
  if (d.slug) return d.slug;
  const base = slugify(d.title);
  if (!base) return String(d.id);
  const taken = all.some((x) => x.id !== d.id && x.id < d.id && slugify(x.title) === base);
  return taken ? `${base}-${d.id}` : base;
}
export const directionPath = (d, all) => `/courses/${directionSlug(d, all)}`;

/** Напрямок за частиною адреси: slug або старий числовий id. */
export function findDirection(all = [], key) {
  const k = String(key ?? '').toLowerCase();
  return all.find((d) => directionSlug(d, all) === k) ?? (/^\d+$/.test(k) ? all.find((d) => String(d.id) === k) : undefined);
}

/* ───────── Текст ───────── */

/** Обрізати по слову до max символів (для description). */
export function clip(text, max = 160) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).replace(/[\s,.;:—-]+$/, '')}…`;
}

const uah = (n) => `${Math.round(Number(n)).toLocaleString('uk-UA').replace(/\s/g, ' ')} грн`;

/** Ціни з абонементів: найдешевше заняття, разове заняття. null, якщо абонементів немає. */
export function priceFacts(plans = []) {
  if (!plans.length) return null;
  const per = plans.map((p) => Number(p.price_per_lesson)).filter((n) => n > 0);
  if (!per.length) return null;
  const cheapest = plans.reduce((a, b) => (Number(b.price_per_lesson) < Number(a.price_per_lesson) ? b : a));
  return {
    min: Math.min(...per),
    max: Math.max(...per),
    minText: uah(Math.min(...per)),
    maxText: uah(Math.max(...per)),
    bestLessons: cheapest.lessons_count,
  };
}
export { uah };

/** Назви курсів через кому для описів: «HTML5&CSS3, Java Script, React.js». */
export function courseList(directions = [], max = 4) {
  const names = directions.map((d) => d.title).filter(Boolean);
  if (!names.length) return '';
  return names.length > max ? `${names.slice(0, max).join(', ')} та інші` : names.join(', ');
}

/* ───────── Питання батьків (сторінка /faq і розмітка FAQPage) ───────── */

/**
 * Питання й відповіді. Перше речення кожної відповіді — пряма відповідь: саме його цитують пошуковики й ШІ.
 * Лише правдиві факти школи; ціни й курси — з кабінету наживо.
 */
export function faqItems(site) {
  const price = priceFacts(site?.plans);
  const list = courseList(site?.directions, 6);
  return [
    {
      q: 'З якого віку дитина може вчитися програмуванню?',
      a: 'З 6 років. Курси розраховані на дітей і підлітків: викладач підбирає програму й темп під вік і досвід учня.',
    },
    {
      q: 'Як проходять заняття?',
      a: 'Онлайн, наживо з викладачем: індивідуально або в групі до 6 учнів. Після кожної теми — домашнє завдання з перевіркою і короткий тест.',
    },
    {
      q: 'Чи потрібен досвід у програмуванні?',
      a: 'Ні, навчання починається з нуля. Якщо дитина вже щось уміє, на пробному занятті визначимо рівень і підберемо курс.',
    },
    {
      q: 'Які курси є в школі?',
      a: list
        ? `Зараз у школі такі курси: ${list}. Кожен курс — це роадмап тем із домашніми завданнями і тестами.`
        : 'Курси веб-програмування для дітей і підлітків. Кожен курс — це роадмап тем із домашніми завданнями і тестами.',
    },
    {
      q: 'Скільки коштує навчання?',
      a: price
        ? `Від ${price.minText} за заняття в абонементі на ${price.bestLessons} занять, одне заняття — ${price.maxText}. Що більше занять в абонементі, то дешевше кожне. Пробне заняття безкоштовне.`
        : 'Ціну підбираємо під формат навчання: залиште заявку, і ми все розповімо. Пробне заняття безкоштовне.',
    },
    {
      q: 'Чи є безкоштовне пробне заняття?',
      a: 'Так, перше пробне заняття безкоштовне. Залиште заявку: ми зателефонуємо, розпитаємо про цілі й досвід дитини і підберемо курс і час.',
    },
    {
      q: 'Як батьки бачать прогрес дитини?',
      a: 'У кабінеті учня: там розклад, домашні завдання, оцінки й пройдені теми роадмапу. Батькам видно все те саме, що й дитині.',
    },
    {
      q: 'Що дитина отримає наприкінці курсу?',
      a: 'Власні проєкти (сайти, ігри, застосунки) у портфоліо і сертифікат після завершення курсу.',
    },
    {
      q: 'Групові чи індивідуальні заняття: що обрати?',
      a: 'Індивідуально — своя програма під цілі й зручний час. У групі до 6 учнів — командна робота і спілкування з однолітками. Не знаєте, що обрати? Підкажемо на пробному занятті.',
    },
  ];
}

/* ───────── Структуровані дані ───────── */

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const SOCIAL_BASE = { instagram: 'https://instagram.com/', tiktok: 'https://www.tiktok.com/@', facebook: 'https://facebook.com/', telegram: 'https://t.me/' };
/** Посилання на офіційні профілі школи (sameAs): лише заповнені в кабінеті. */
export function sameAs(contacts = {}) {
  return Object.entries(SOCIAL_BASE).map(([k, base]) => {
    const v = String(contacts?.[k] ?? '').trim();
    if (!v) return null;
    return /^https?:\/\//.test(v) ? v : base + v.replace(/^@/, '');
  }).filter(Boolean);
}

/** Школа й сайт: на кожній сторінці. Школа онлайн, тож без фізичної адреси (не LocalBusiness). */
export function orgJsonLd(site) {
  const c = site?.contacts ?? {};
  const org = {
    '@type': 'EducationalOrganization',
    '@id': ORG_ID,
    name: SCHOOL,
    url: abs('/'),
    logo: abs('/favicon.svg'),
    image: abs(OG_IMAGE),
    description: SCHOOL_ABOUT,
    slogan: SCHOOL_TAGLINE,
    areaServed: { '@type': 'Country', name: 'Україна' },
    knowsLanguage: 'uk',
  };
  if (c.phone) org.telephone = c.phone;
  if (c.email) org.email = c.email;
  if (c.phone || c.email) {
    org.contactPoint = [{ '@type': 'ContactPoint', contactType: 'customer service', availableLanguage: 'uk', ...(c.phone && { telephone: c.phone }), ...(c.email && { email: c.email }) }];
  }
  const links = sameAs(c);
  if (links.length) org.sameAs = links;
  return [
    org,
    { '@type': 'WebSite', '@id': WEBSITE_ID, url: abs('/'), name: SCHOOL, description: SCHOOL_TAGLINE, inLanguage: 'uk', publisher: { '@id': ORG_ID } },
  ];
}

/** Хлібні крихти: [['Курси', '/courses'], ['Python', '/courses/python']]. Головна додається сама. */
export function breadcrumbs(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [['Головна', '/'], ...items].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
  };
}

function offerFor(site, path) {
  const price = priceFacts(site?.plans);
  if (!price) return undefined;
  return {
    '@type': 'AggregateOffer',
    category: 'Paid',
    priceCurrency: 'UAH',
    lowPrice: price.min,
    highPrice: price.max,
    offerCount: site.plans.length,
    url: abs(path),
    availability: 'https://schema.org/InStock',
  };
}

/** Курс (напрямок): опис, програма, формат онлайн, ціна від — усе, що є на сторінці. */
export function courseJsonLd(course, site, path, description) {
  const topics = course.courses.flatMap((c) => c.steps.map((s) => s.title));
  return {
    '@type': 'Course',
    '@id': `${abs(path)}#course`,
    name: course.title,
    description,
    url: abs(path),
    inLanguage: 'uk',
    provider: { '@id': ORG_ID },
    audience: { '@type': 'EducationalAudience', educationalRole: 'student', audienceType: 'Діти й підлітки' },
    ...(topics.length && { teaches: topics.slice(0, 30), syllabusSections: topics.slice(0, 30).map((name) => ({ '@type': 'Syllabus', name })) }),
    ...(course.cover && { image: abs(`/api/site/images/${course.cover}`) }),
    hasCourseInstance: [{ '@type': 'CourseInstance', courseMode: 'online', inLanguage: 'uk' }],
    ...(offerFor(site, '/prices') && { offers: offerFor(site, '/prices') }),
  };
}

export function courseListJsonLd(directions) {
  return {
    '@type': 'ItemList',
    name: 'Курси програмування для дітей і підлітків',
    itemListElement: directions.map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Course',
        name: d.title,
        url: abs(directionPath(d, directions)),
        description: d.summary || `Онлайн-курс ${d.title} для дітей і підлітків у ${SCHOOL}.`,
        provider: { '@id': ORG_ID },
      },
    })),
  };
}

export function pricesJsonLd(plans) {
  return {
    '@type': 'OfferCatalog',
    name: 'Абонементи на заняття з програмування',
    itemListElement: plans.map((p) => ({
      '@type': 'Offer',
      name: `${p.name}: ${p.lessons_count} занять`,
      price: Number(p.total),
      priceCurrency: 'UAH',
      category: 'Paid',
      availability: 'https://schema.org/InStock',
      seller: { '@id': ORG_ID },
      ...(p.valid_days && { eligibleDuration: { '@type': 'QuantitativeValue', value: p.valid_days, unitCode: 'DAY' } }),
    })),
  };
}

export function faqJsonLd(items) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
}

/** Відгуки як контент сторінки, без зірочок: власні відгуки школи Google зірочками не показує. */
export function reviewsJsonLd(reviews) {
  return {
    '@type': 'ItemList',
    name: `Відгуки про ${SCHOOL}`,
    itemListElement: reviews.slice(0, 30).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: { '@type': 'Review', reviewBody: r.text, author: { '@type': 'Person', name: r.author }, itemReviewed: { '@id': ORG_ID } },
    })),
  };
}

/* ───────── Мета сторінок ───────── */

/**
 * Мета однієї сторінки. title — без назви школи (вона додається сама), description — 140–160 символів.
 * noindex — службові й порожні сторінки.
 */
export function makeMeta({ title, description, path, noindex = false, jsonLd = [], type = 'website', image }) {
  return { title, description: clip(description, 160), path, noindex, jsonLd, type, image };
}

export const fullTitle = (title) => (title ? `${title} — ${SCHOOL}` : `${SCHOOL_TAGLINE} — ${SCHOOL}`);

export function homeMeta(site) {
  const list = courseList(site?.directions, 4);
  return makeMeta({
    title: null,
    path: '/',
    description: `Курси програмування для дітей і підлітків онлайн${list ? `: ${list}` : ''}. Заняття з викладачем індивідуально або в групі до 6 учнів. Пробне заняття безкоштовно.`,
  });
}

export function coursesMeta(site) {
  const dirs = site?.directions ?? [];
  const list = courseList(dirs, 4);
  return makeMeta({
    title: 'Курси програмування для дітей і підлітків онлайн',
    path: '/courses',
    description: `${list ? `${list}: ` : ''}онлайн-курси програмування для дітей і підлітків з викладачем. Програма за темами, домашні з перевіркою, сертифікат. Пробне заняття безкоштовно.`,
    jsonLd: [breadcrumbs([['Курси', '/courses']]), ...(dirs.length ? [courseListJsonLd(dirs)] : [])],
  });
}

/** Опис курсу: опис із кабінету або перші теми програми. */
export function courseDescription(course) {
  if (course.summary) return course.summary;
  // «Етап 1. Основи мови» → «Основи мови»: нумерація програми в описі лише заважає
  const steps = course.courses.flatMap((c) => c.steps.map((s) => s.title.replace(/^(етап|крок|модуль|тема|урок|частина)?\s*\d+[.:)]?\s*/i, '').trim()));
  const n = steps.length;
  return `Онлайн-курс ${course.title} для дітей і підлітків${n ? `: ${topicsWord(n)}, серед них ${steps.slice(0, 3).join(', ')}` : ''}. `
    + 'Заняття з викладачем, домашні з перевіркою, сертифікат. Пробне заняття безкоштовно.';
}

export function courseMeta(course, site) {
  const all = site?.directions ?? [course];
  const path = directionPath(course, all.some((d) => d.id === course.id) ? all : [...all, course]);
  const description = courseDescription(course);
  return makeMeta({
    title: `${course.title}: онлайн-курс для дітей і підлітків`,
    path,
    description,
    image: course.cover ? `/api/site/images/${course.cover}` : undefined,
    jsonLd: [breadcrumbs([['Курси', '/courses'], [course.title, path]]), courseJsonLd(course, site, path, clip(description, 300))],
  });
}

export function pricesMeta(site) {
  const plans = site?.plans ?? [];
  const price = priceFacts(plans);
  return makeMeta({
    title: 'Ціни на курси програмування для дітей',
    path: '/prices',
    description: price
      ? `Вартість занять з програмування для дітей: від ${price.minText} за заняття в абонементі, разове заняття — ${price.maxText}. Онлайн з викладачем. Пробне заняття безкоштовно.`
      : 'Вартість занять з програмування для дітей і підлітків онлайн. Абонементи на кілька занять: що більше занять, то дешевше кожне. Пробне заняття безкоштовно.',
    jsonLd: [breadcrumbs([['Ціни', '/prices']]), ...(plans.length ? [pricesJsonLd(plans)] : [])],
  });
}

export function reviewsMeta(site) {
  const reviews = site?.reviews ?? [];
  return makeMeta({
    title: 'Відгуки батьків і учнів',
    path: '/reviews',
    description: `Відгуки батьків і учнів про онлайн-курси програмування ${SCHOOL}: як навчаються діти й підлітки, що вони створюють і чого досягають.`,
    noindex: site ? reviews.length === 0 : false,
    jsonLd: [breadcrumbs([['Відгуки', '/reviews']]), ...(reviews.length ? [reviewsJsonLd(reviews)] : [])],
  });
}

export function projectsMeta(site) {
  const projects = site?.projects ?? [];
  return makeMeta({
    title: 'Проєкти учнів: сайти, ігри й застосунки',
    path: '/projects',
    description: `Що створюють учні ${SCHOOL} на курсах програмування: сайти, ігри, боти й застосунки. Справжні проєкти дітей і підлітків.`,
    // Порожня сторінка — «тонкий» контент: не індексуємо, доки не зʼявляться проєкти
    noindex: site ? projects.length === 0 : false,
    jsonLd: [breadcrumbs([['Проєкти учнів', '/projects']])],
  });
}

export function faqMeta(site) {
  const items = faqItems(site);
  return makeMeta({
    title: 'Питання й відповіді для батьків',
    path: '/faq',
    description: 'З якого віку вчити дитину програмуванню, як проходять онлайн-заняття, скільки коштує навчання і як батьки бачать прогрес: відповіді на часті питання.',
    jsonLd: [breadcrumbs([['Питання й відповіді', '/faq']]), faqJsonLd(items)],
  });
}

export function privacyMeta() {
  return makeMeta({
    title: 'Політика конфіденційності',
    path: '/privacy',
    description: `Які персональні дані збирає ${SCHOOL} через форму заявки, навіщо, де вони зберігаються, як довго і як їх видалити.`,
    jsonLd: [breadcrumbs([['Політика конфіденційності', '/privacy']])],
  });
}

export function notFoundMeta(title = 'Сторінку не знайдено') {
  return makeMeta({ title, path: null, description: `${title}. Перегляньте курси програмування для дітей і підлітків у ${SCHOOL}.`, noindex: true });
}

/* ───────── Голова сторінки (для збірки) ───────── */

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** JSON усередині <script>: «</script>» і подібне не закриє тег. */
export const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Повний JSON-LD сторінки: школа й сайт + розмітка самої сторінки. */
export function pageJsonLd(meta, site) {
  return { '@context': 'https://schema.org', '@graph': [...orgJsonLd(site), ...(meta.jsonLd ?? [])] };
}

/** Теги <head>: title, description, canonical, robots, Open Graph, Twitter, JSON-LD. */
export function headTags(meta, site, { verify = {} } = {}) {
  const title = fullTitle(meta.title);
  const url = meta.path ? abs(meta.path) : null;
  const image = abs(meta.image || OG_IMAGE);
  const tags = [
    `<title>${escText(title)}</title>`,
    `<meta name="description" content="${escAttr(meta.description)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex, follow" />' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />',
    url && !meta.noindex ? `<link rel="canonical" href="${escAttr(url)}" />` : null,
    `<meta property="og:site_name" content="${SCHOOL}" />`,
    `<meta property="og:locale" content="uk_UA" />`,
    `<meta property="og:type" content="${meta.type || 'website'}" />`,
    `<meta property="og:title" content="${escAttr(meta.title || title)}" />`,
    `<meta property="og:description" content="${escAttr(meta.description)}" />`,
    url ? `<meta property="og:url" content="${escAttr(url)}" />` : null,
    `<meta property="og:image" content="${escAttr(image)}" />`,
    meta.image ? null : '<meta property="og:image:width" content="1200" />',
    meta.image ? null : '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${escAttr(`${SCHOOL}: ${SCHOOL_TAGLINE.toLowerCase()}`)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    verify.google ? `<meta name="google-site-verification" content="${escAttr(verify.google)}" />` : null,
    verify.bing ? `<meta name="msvalidate.01" content="${escAttr(verify.bing)}" />` : null,
    `<script type="application/ld+json" data-seo>${safeJson(pageJsonLd(meta, site))}</script>`,
  ];
  return tags.filter(Boolean).join('\n    ');
}

/* ───────── robots.txt, sitemap.xml, llms.txt ───────── */

// Пошукові та ШІ-боти дозволені явно: мета — видимість і в пошуку, і у відповідях ШІ.
const BOTS = [
  'Googlebot', 'Google-Extended', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
  'PerplexityBot', 'Perplexity-User', 'Applebot', 'Applebot-Extended',
];
const PRIVATE = ['/cabinet', '/q/', '/api/'];

export function robotsTxt() {
  const rules = ['Allow: /', 'Allow: /api/site/images/', ...PRIVATE.map((p) => `Disallow: ${p}`)];
  return [
    '# Сайт школи відкритий для пошукових і ШІ-ботів. Закриті лише кабінет, тести за посиланням і API.',
    ...BOTS.flatMap((b) => [`User-agent: ${b}`, ...rules, '']),
    'User-agent: *',
    ...rules,
    '',
    `Sitemap: ${abs('/sitemap.xml')}`,
    '',
  ].join('\n');
}

/** pages — [{ path, lastmod?, priority? }], лише канонічні сторінки, які індексуються. */
export function sitemapXml(pages) {
  const rows = pages.map((p) => [
    '  <url>',
    `    <loc>${escText(abs(p.path))}</loc>`,
    p.lastmod ? `    <lastmod>${p.lastmod}</lastmod>` : null,
    p.priority ? `    <priority>${p.priority}</priority>` : null,
    '  </url>',
  ].filter(Boolean).join('\n'));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

/** Короткий опис школи в Markdown для ШІ-агентів (неофіційний стандарт llms.txt). */
export function llmsTxt(site, courses = []) {
  const c = site?.contacts ?? {};
  const price = priceFacts(site?.plans);
  const dirs = site?.directions ?? [];
  const lines = [
    `# ${SCHOOL}`,
    '',
    `> ${SCHOOL_ABOUT}`,
    '',
    '## Головне',
    '',
    '- Формат: онлайн, наживо з викладачем; індивідуально або в групі до 6 учнів.',
    '- Вік: діти й підлітки від 6 років. Навчання з нуля.',
    '- Як навчаємо: роадмап тем, домашні завдання з перевіркою, тест після кожної теми, кабінет учня, у якому батьки бачать прогрес.',
    '- Наприкінці курсу: власні проєкти в портфоліо і сертифікат.',
    '- Перше пробне заняття безкоштовне.',
    price ? `- Ціна: від ${price.minText} за заняття в абонементі, одне заняття — ${price.maxText}.` : null,
    '',
    '## Курси',
    '',
    ...(dirs.length
      ? dirs.map((d) => {
        const full = courses.find((x) => x.id === d.id);
        const desc = full ? courseDescription(full) : (d.summary || `Онлайн-курс ${d.title} для дітей і підлітків.`);
        return `- [${d.title}](${abs(directionPath(d, dirs))}): ${clip(desc, 200)}`;
      })
      : [`- [Усі курси](${abs('/courses')})`]),
    '',
    '## Сторінки',
    '',
    `- [Ціни](${abs('/prices')}): абонементи й вартість заняття`,
    `- [Питання й відповіді](${abs('/faq')}): вік, формат, ціни, пробне заняття`,
    ...(site?.reviews?.length ? [`- [Відгуки](${abs('/reviews')}): що кажуть батьки й учні`] : []),
    ...(site?.projects?.length ? [`- [Проєкти учнів](${abs('/projects')})`] : []),
    '',
    '## Питання батьків',
    '',
    ...faqItems(site).flatMap(({ q, a }) => [`### ${q}`, '', a, '']),
    '## Контакти',
    '',
    `- Сайт: ${abs('/')}`,
    c.phone ? `- Телефон: ${c.phone}` : null,
    c.email ? `- Email: ${c.email}` : null,
    ...sameAs(c).map((u) => `- ${u}`),
    `- Записатись на пробне заняття: ${abs('/')} (кнопка «Записатись»)`,
    '',
  ];
  return lines.filter((l) => l !== null).join('\n');
}
