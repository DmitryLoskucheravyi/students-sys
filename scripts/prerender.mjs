// Пререндер сайту школи після `vite build`: кожна сторінка — готовий HTML з текстом, мета-тегами й JSON-LD.
// Пошуковики й ШІ-боти (більшість не виконує JavaScript) бачать увесь зміст; браузер підміняє розмітку React-ом.
//
//   SITE_API=https://students-sys.onrender.com/api node scripts/prerender.mjs
//
// SITE_API — звідки взяти курси, ціни, відгуки й контакти. Без нього (локальна збірка, тести) сторінки
// збираються лише з постійними текстами, а дані браузер підтягне сам. Якщо SITE_API задано, але API
// недоступний, збірка падає: краще не задеплоїти, ніж віддати пошуковикам сайт без курсів.
// Необовʼязково: GOOGLE_SITE_VERIFICATION, BING_SITE_VERIFICATION — коди підтвердження сайту.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'client', 'dist');
const ssrDir = path.join(root, 'dist', 'site-ssr');

const ssr = await import(pathToFileURL(path.join(ssrDir, 'ssr.js')).href);
const { render, headTags, safeJson, robotsTxt, sitemapXml, llmsTxt, directionPath, INDEXNOW_KEY } = ssr;

/* ───────── Дані сайту ───────── */

async function getJson(url) {
  // Render на безкоштовному плані засинає: перший запит будить його до хвилини
  let last;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90_000), headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      last = err;
      console.warn(`prerender: ${url} — спроба ${attempt}: ${err.message}`);
    }
  }
  throw last;
}

const api = process.env.SITE_API?.replace(/\/+$/, '');
let site = null;
let courses = [];
if (api) {
  try {
    site = await getJson(`${api}/site`);
    courses = await Promise.all(site.directions.map((d) => getJson(`${api}/site/courses/${d.id}`)));
  } catch (err) {
    console.error(`prerender: дані сайту недоступні (${err.message}). Збірку зупинено.`);
    process.exit(1);
  }
} else {
  console.log('prerender: SITE_API не задано — сторінки без даних з кабінету (курсів, цін, відгуків).');
}

/* ───────── Шаблон ───────── */

const template = await readFile(path.join(dist, 'index.html'), 'utf8');
if (!template.includes('<!--seo-->') || !template.includes('<!--app-->')) throw new Error('prerender: у client/index.html немає позначок <!--seo--> і <!--app-->');

// CSS і JS сайту йдуть окремим шматком (lazy). Підключаємо їх у <head> одразу: зібраний HTML має бути зі стилями
// від першого кадру, а Vite не завантажує вдруге те, що вже є на сторінці.
const manifest = JSON.parse(await readFile(path.join(dist, '.vite', 'manifest.json'), 'utf8'));
function chunkAssets(key, seen = new Set()) {
  if (seen.has(key) || !manifest[key]) return { css: [], js: [] };
  seen.add(key);
  const m = manifest[key];
  const out = { css: [...(m.css ?? [])], js: [m.file] };
  for (const k of m.imports ?? []) {
    const sub = chunkAssets(k, seen);
    out.css.push(...sub.css);
    out.js.push(...sub.js);
  }
  return out;
}
const siteKey = Object.keys(manifest).find((k) => k.endsWith('site/Site.jsx'));
if (!siteKey) throw new Error('prerender: у manifest немає site/Site.jsx');
const assets = chunkAssets(siteKey);
const entryCss = new Set(Object.values(manifest).filter((m) => m.isEntry).flatMap((m) => m.css ?? []));
const assetTags = [
  ...[...new Set(assets.css)].filter((c) => !entryCss.has(c)).map((c) => `<link rel="stylesheet" crossorigin href="/${c}" />`),
  ...[...new Set(assets.js)].map((j) => `<link rel="modulepreload" crossorigin href="/${j}" />`),
].join('\n    ');

const verifyHome = { google: process.env.GOOGLE_SITE_VERIFICATION, bing: process.env.BING_SITE_VERIFICATION };

function page({ html = '', meta, boot, verify }) {
  const head = headTags(meta, site, { verify });
  const bootTag = boot ? `<script type="application/json" id="site-boot">${safeJson(boot)}</script>\n    ` : '';
  return template
    .replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, head)
    // Стилі сайту — після загальних (styles.css), як і тоді, коли їх підвантажує Vite: інакше палітра кабінету перекриє сайт
    .replace('</head>', `  ${assetTags}\n  </head>`)
    .replace('<!--app-->', html)
    .replace('<script type="module"', `${bootTag}<script type="module"`);
}

async function write(file, content) {
  const full = path.join(dist, file);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content);
}

/* ───────── Сторінки ───────── */

// Оболонка кабінету й тестів за посиланням: без змісту сайту і закрита від індексації.
// Пишемо першою, поки index.html ще чистий шаблон.
await write('app.html', template
  .replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, '<title>Be Smart School</title>\n    <meta name="robots" content="noindex, nofollow" />')
  .replace('<!--app-->', ''));

const boot = site ? { site } : null;
const today = new Date().toISOString().slice(0, 10);
const routes = [
  { url: '/', file: 'index.html', priority: '1.0', verify: verifyHome },
  { url: '/courses', file: 'courses.html', priority: '0.9' },
  ...(site?.directions ?? []).map((d, k) => ({
    url: directionPath(d, site.directions),
    file: `${directionPath(d, site.directions).slice(1)}.html`,
    priority: '0.8',
    boot: { site, course: courses[k] },
  })),
  { url: '/prices', file: 'prices.html', priority: '0.8' },
  { url: '/faq', file: 'faq.html', priority: '0.7' },
  { url: '/reviews', file: 'reviews.html', priority: '0.6' },
  { url: '/projects', file: 'projects.html', priority: '0.6' },
  { url: '/privacy', file: 'privacy.html', priority: '0.2' },
  // Неіснуюча адреса: Vercel віддає 404.html зі статусом 404
  { url: '/404', file: '404.html', sitemap: false },
];

const inSitemap = [];
for (const r of routes) {
  const b = r.boot ?? boot;
  const { html, meta } = render(r.url, b ?? {});
  if (!meta) throw new Error(`prerender: сторінка ${r.url} не віддала мету (useSeo)`);
  await write(r.file, page({ html, meta, boot: b, verify: r.verify }));
  if (r.sitemap !== false && !meta.noindex && meta.path) inSitemap.push({ path: meta.path, lastmod: today, priority: r.priority });
  console.log(`prerender: ${r.url.padEnd(40)} ${meta.noindex ? 'noindex' : 'index  '} ${(meta.title ?? '').slice(0, 60)}`);
}

await write('sitemap.xml', sitemapXml(inSitemap));
await write('robots.txt', robotsTxt());
await write('llms.txt', llmsTxt(site, courses));
// Ключ IndexNow: файл з ключем у корені підтверджує, що сповіщення про нові сторінки надсилає власник сайту
await write(`${INDEXNOW_KEY}.txt`, INDEXNOW_KEY);
await rm(path.join(dist, '.vite'), { recursive: true, force: true });
console.log(`prerender: ${routes.length} сторінок, у sitemap ${inSitemap.length}.`);
