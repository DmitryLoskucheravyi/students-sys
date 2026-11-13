// Перевірка живого сайту після деплою: увесь ланцюжок браузер → Vercel → Render → база.
// Паролі не потрібні, дані не змінюються. Запуск: node scripts/smoke.mjs https://сайт.vercel.app
const site = process.argv[2]?.replace(/\/$/, '');
if (!site) throw new Error('Використання: smoke.mjs <адреса сайту>');

const failures = [];
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? `  [${extra}]` : ''}`);
  if (!ok) failures.push(name);
};
// Render міг заснути: перший запит будить його близько хвилини.
const get = (path, init = {}) => fetch(`${site}${path}`, { signal: AbortSignal.timeout(110_000), redirect: 'manual', ...init });

const home = await get('/');
const html = await home.text();
check('сторінка відкривається', home.status === 200, String(home.status));
check('це наш застосунок', html.includes('Be Smart School'));
check('заголовок CSP на сторінці', (home.headers.get('content-security-policy') ?? '').includes("script-src 'self'"));

const deep = await get('/courses/1');
check('глибоке посилання віддає застосунок', deep.status === 200 && (await deep.text()).includes('id="root"'));

const cabinet = await get('/cabinet/homework');
check('кабінет на /cabinet віддає застосунок', cabinet.status === 200 && (await cabinet.text()).includes('id="root"'));

const siteApi = await get('/api/site');
const siteData = await siteApi.json().catch(() => null);
check('дані сайту школи доступні без входу', siteApi.status === 200 && Array.isArray(siteData?.courses) && Array.isArray(siteData?.plans), String(siteApi.status));

const health = await get('/api/health');
check('проксі доходить до API і бази', health.status === 200 && (await health.json().catch(() => null))?.ok === true, String(health.status));

const me = await get('/api/auth/me');
check('анонім без сесії', me.status === 200 && (await me.json().catch(() => 'x')) === null, String(me.status));

const closed = await get('/api/users');
check('закриті дані вимагають входу', closed.status === 401, String(closed.status));

const login = await get('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'smoke-check-no-such-user', password: 'wrong-password' }),
});
check('неправильний вхід відхилено', login.status === 401 && (await login.json().catch(() => null))?.error?.includes('Неправильний'), String(login.status));

// Домашні бувають великими. Vercel не має обрізати їх на шляху до API: сервер відповість 401, а не проксі 413.
const big = new FormData();
big.append('files', new Blob([new Uint8Array(6 * 1024 * 1024)]), 'big.bin');
const upload = await get('/api/homework/1/submission', { method: 'POST', body: big });
check('файл на 6 МБ проходить через проксі', upload.status === 401, `${upload.status} ${upload.headers.get('x-vercel-error') ?? ''}`.trim());

console.log(failures.length ? `\nНе пройшло: ${failures.join(', ')}` : '\nСайт працює.');
process.exit(failures.length ? 1 : 0);
