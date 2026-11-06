// Чекає, поки Render почне віддавати потрібний коміт. Безкоштовний план збирає образ кілька хвилин.
const [, , backend, commit] = process.argv;
if (!backend || !commit) throw new Error('Використання: wait-for-deploy.mjs <адреса API> <коміт>');

const deadline = Date.now() + 15 * 60 * 1000;
let last = 'немає відповіді';
while (Date.now() < deadline) {
  try {
    const res = await fetch(`${backend}/healthz`, { signal: AbortSignal.timeout(90_000) });
    const body = await res.json();
    last = body.commit ?? 'без коміту';
    if (body.commit === commit) {
      console.log(`Render віддає ${commit}`);
      process.exit(0);
    }
  } catch (e) {
    last = e.name;
  }
  console.log(`Чекаємо ${commit}, зараз: ${last}`);
  await new Promise((r) => setTimeout(r, 20_000));
}
console.error(`За 15 хвилин деплой не завершився. Останній стан: ${last}`);
process.exit(1);
