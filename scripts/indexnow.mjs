// Повідомити Bing та інших учасників IndexNow про сторінки сайту після деплою: нові курси й зміни потрапляють
// в індекс за години, а не тижні. На індексі Bing частково працюють ChatGPT Search і Copilot.
// Запуск: node scripts/indexnow.mjs https://сайт   (адреси бере з живого /sitemap.xml)
const site = process.argv[2]?.replace(/\/+$/, '');
if (!site) throw new Error('Використання: indexnow.mjs <адреса сайту>');

const { INDEXNOW_KEY } = await import('../dist/site-ssr/ssr.js').catch(() => ({}));
const key = process.env.INDEXNOW_KEY || INDEXNOW_KEY;
if (!key) throw new Error('Немає ключа IndexNow: зберіть сайт (npm run build) або задайте INDEXNOW_KEY');

const sitemap = await (await fetch(`${site}/sitemap.xml`, { signal: AbortSignal.timeout(30_000) })).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
if (!urls.length) throw new Error('У sitemap.xml немає адрес');
const host = new URL(urls[0]).host;

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: urls }),
  signal: AbortSignal.timeout(30_000),
});
// 200 і 202 — прийнято; решта не валить деплой, лише попереджає
console.log(`IndexNow: ${urls.length} адрес, відповідь ${res.status}`);
if (!res.ok) console.warn(await res.text().catch(() => ''));
