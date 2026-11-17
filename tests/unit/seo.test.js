import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SITE_URL, clip, courseDescription, courseMeta, directionPath, directionSlug, faqItems, findDirection, headTags, homeMeta,
  llmsTxt, priceFacts, pricesMeta, projectsMeta, robotsTxt, safeJson, sameAs, sitemapXml, slugify,
} from '../../client/src/site/seo.js';

const PLANS = [
  { id: 1, name: 'Одноразовий', lessons_count: 1, price_per_lesson: 450, total: 450, valid_days: 30 },
  { id: 2, name: 'Великий', lessons_count: 32, price_per_lesson: 350, total: 11200, valid_days: 30 },
];
const DIRS = [
  { id: 1, title: 'HTML5&CSS3', summary: null, courses: [{ id: 10 }] },
  { id: 2, title: 'JS middle+', summary: 'Глибоко про JavaScript.', courses: [{ id: 11 }] },
];

test('slug: транслітерація КМУ-2010, символи, обрізання', () => {
  assert.equal(slugify('Python для дітей'), 'python-dlia-ditei');
  assert.equal(slugify('Житомир'), 'zhytomyr');
  assert.equal(slugify('Їжак і Юля'), 'yizhak-i-yulia');
  assert.equal(slugify('Згода'), 'zghoda');
  assert.equal(slugify('HTML5&CSS3'), 'html5-css3');
  assert.equal(slugify('JS middle+'), 'js-middle-plus');
  assert.equal(slugify('C#'), 'c-sharp');
  assert.equal(slugify('React.js'), 'react-js');
  assert.equal(slugify("Об'єкти"), 'obiekty');
  assert.equal(slugify('  ---  '), '');
  assert.ok(slugify('а'.repeat(200)).length <= 80);
});

test('адреса курсу: slug, збіг назв, порожній slug, пошук за старим id', () => {
  assert.equal(directionPath(DIRS[0], DIRS), '/courses/html5-css3');
  const twins = [{ id: 3, title: 'Python' }, { id: 7, title: 'Python' }];
  assert.equal(directionSlug(twins[0], twins), 'python');
  assert.equal(directionSlug(twins[1], twins), 'python-7');
  assert.equal(directionSlug({ id: 9, title: '+++' }), 'plus-plus-plus');
  assert.equal(directionSlug({ id: 9, title: '—' }), '9');
  assert.equal(findDirection(DIRS, 'js-middle-plus').id, 2);
  assert.equal(findDirection(DIRS, '2').id, 2, 'стара числова адреса');
  assert.equal(findDirection(DIRS, 'JS-Middle-Plus').id, 2);
  assert.equal(findDirection(DIRS, 'nope'), undefined);
  assert.equal(findDirection(twins, 'python-7').id, 7);
});

test('clip: по слову, без хвостових розділових знаків', () => {
  assert.equal(clip('коротко'), 'коротко');
  const long = 'слово '.repeat(60);
  const out = clip(long, 160);
  assert.ok(out.length <= 160 && out.endsWith('…') && !out.includes('  '));
  assert.equal(clip('a\n\n b'), 'a b');
});

test('ціни: найдешевше й разове заняття', () => {
  const p = priceFacts(PLANS);
  assert.equal(p.min, 350);
  assert.equal(p.max, 450);
  assert.equal(p.bestLessons, 32);
  assert.match(p.minText, /^350 грн$/);
  assert.equal(priceFacts([]), null);
  assert.match(pricesMeta({ plans: PLANS }).description, /від 350 грн/);
});

test('мета головної й курсу: довжина, канонічна адреса, JSON-LD', () => {
  const home = homeMeta({ directions: DIRS, plans: PLANS });
  assert.ok(home.description.length <= 160);
  assert.match(home.description, /HTML5&CSS3, JS middle\+/);
  const course = { ...DIRS[0], courses: [{ id: 10, steps: [{ title: 'Етап 1. Основи' }, { title: 'Крок 2: Форми' }, { title: 'Флекс' }] }] };
  assert.match(courseDescription(course), /3 теми, серед них Основи, Форми, Флекс/);
  const m = courseMeta(course, { directions: DIRS, plans: PLANS });
  assert.equal(m.path, '/courses/html5-css3');
  const types = m.jsonLd.map((x) => x['@type']);
  assert.deepEqual(types, ['BreadcrumbList', 'Course']);
  assert.equal(m.jsonLd[1].offers.lowPrice, 350);
  assert.equal(m.jsonLd[1].hasCourseInstance[0].courseMode, 'online');
});

test('порожні проєкти — noindex; без даних — індексуємо', () => {
  assert.equal(projectsMeta({ projects: [] }).noindex, true);
  assert.equal(projectsMeta({ projects: [{ id: 1 }] }).noindex, false);
  assert.equal(projectsMeta(null).noindex, false);
});

test('голова сторінки: екранування, canonical, noindex, verify', () => {
  const meta = { title: 'A "B" <c>', description: 'd & e', path: '/x', jsonLd: [] };
  const h = headTags(meta, { contacts: { phone: '+380961112233', instagram: '@school' } }, { verify: { google: 'g1' } });
  assert.match(h, /<title>A "B" &lt;c&gt; — Be Smart School<\/title>/);
  assert.match(h, /content="d &amp; e"/);
  assert.match(h, new RegExp(`<link rel="canonical" href="${SITE_URL}/x" />`));
  assert.match(h, /google-site-verification" content="g1"/);
  assert.match(h, /"sameAs":\["https:\/\/instagram.com\/school"\]/);
  const hidden = headTags({ ...meta, noindex: true }, null);
  assert.match(hidden, /noindex/);
  assert.doesNotMatch(hidden, /canonical/);
});

test('JSON у <script> не закриває тег', () => {
  assert.equal(safeJson({ a: '</script><b>' }), '{"a":"\\u003c/script\\u003e\\u003cb\\u003e"}');
  assert.deepEqual(JSON.parse(safeJson({ a: '</script>&' })), { a: '</script>&' });
});

test('соцмережі: нік або повна адреса, порожні пропускаються', () => {
  assert.deepEqual(sameAs({ telegram: '@bs', facebook: 'https://facebook.com/bs', tiktok: '' }), ['https://facebook.com/bs', 'https://t.me/bs']);
  assert.deepEqual(sameAs(undefined), []);
});

test('robots, sitemap, llms.txt', () => {
  const r = robotsTxt();
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot', 'Google-Extended', 'Bingbot']) assert.match(r, new RegExp(`User-agent: ${bot}`));
  assert.match(r, /Disallow: \/cabinet/);
  assert.match(r, /Allow: \/api\/site\/images\//);
  assert.match(r, new RegExp(`Sitemap: ${SITE_URL}/sitemap.xml`));
  const sm = sitemapXml([{ path: '/', lastmod: '2026-01-01', priority: '1.0' }, { path: '/a&b' }]);
  assert.match(sm, /<loc>https:\/\/[^<]+\/<\/loc>/);
  assert.match(sm, /a&amp;b/);
  const llms = llmsTxt({ directions: DIRS, plans: PLANS, contacts: { phone: '+380961112233' } });
  assert.match(llms, /^# Be Smart School/);
  assert.match(llms, /\[JS middle\+\]\(https:\/\/[^)]+\/courses\/js-middle-plus\): Глибоко про JavaScript\./);
  assert.match(llms, /від 350 грн/);
  assert.equal(faqItems(null).length, faqItems({ plans: PLANS, directions: DIRS }).length);
});
