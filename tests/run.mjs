// Наскрізні тести: окрема база, тимчасова папка файлів, власний сервер, підставний Gemini.
// Запуск: npm run test:e2e           усі набори
//         npm run test:e2e -- ai     лише tests/e2e/ai.py
import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DB = 'bs_school_test';
const PORT = '3101';
const PYTHON = process.env.PYTHON || 'python';

const DRAFT = {
  steps: [
    { title: 'Основи', description: 'Перші кроки', substeps: ['Змінні', 'Типи'] },
    { title: 'Функції', substeps: ['Аргументи', 'Повернення', 'Область видимості'] },
    { title: 'Проєкт', substeps: [] },
  ],
};

/** Підставний Gemini: сценарій задає слово в тексті, а ключ перевіряється, як у справжнього. */
function startFakeGemini() {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const reply = (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      };
      const text = (json) => reply(200, { candidates: [{ content: { parts: [{ text: json }] } }] });
      if (req.headers['x-goog-api-key'] !== 'test-key') return reply(401, { error: { message: 'bad key' } });
      const prompt = JSON.parse(body).contents[0].parts[0].text;
      if (prompt.includes('СЦЕНАРІЙ_ЛІМІТ')) return reply(429, { error: { message: 'quota' } });
      if (prompt.includes('СЦЕНАРІЙ_БИТИЙ')) return text('{"steps": [');
      if (prompt.includes('СЦЕНАРІЙ_ПОРОЖНЬО')) return text('{"steps": []}');
      if (prompt.includes('СЦЕНАРІЙ_РЕЗЕРВ') && req.url.includes('gemini-flash-latest')) return reply(503, {});
      return text(JSON.stringify(DRAFT));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/**
 * Підставний Telegram: приймає sendMessage для бота test-bot і складає повідомлення.
 * GET /_messages віддає зібране тесту; DELETE /_messages очищає.
 */
function startFakeTelegram() {
  const messages = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
      if (req.url === '/_messages') {
        if (req.method === 'DELETE') messages.length = 0;
        return reply(200, messages);
      }
      if (req.url !== '/bottest-bot/sendMessage') return reply(401, { ok: false, description: 'Unauthorized' });
      messages.push(JSON.parse(body));
      return reply(200, { ok: true, result: { message_id: messages.length } });
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function dropTestDb(env) {
  const conn = await mysql.createConnection({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306), user: env.DB_USER || 'root', password: env.DB_PASSWORD ?? '', ...(env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}) });
  await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await conn.end();
}

async function ensureBucket(env) {
  if (env.S3_CREATE_BUCKET !== 'true') return;
  const { S3Client, CreateBucketCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT, region: env.S3_REGION || 'auto', forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET })).catch((e) => {
    if (e.name !== 'BucketAlreadyOwnedByYou') throw e;
  });
}

async function waitUntilUp() {
  for (let i = 0; i < 60; i++) {
    const ok = await fetch(`http://127.0.0.1:${PORT}/healthz`).then((r) => r.ok).catch(() => false);
    if (ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Тестовий сервер не запустився');
}

async function runSuite(file, env) {
  await dropTestDb(env);
  const seed = spawnSync(process.execPath, ['dist/server/seed.js'], { cwd: root, env, stdio: ['ignore', 'ignore', 'inherit'] });
  if (seed.status !== 0) throw new Error('Не вдалося заповнити тестову базу');
  const server = spawn(process.execPath, ['dist/server/main.js'], { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] });
  let serverErrors = '';
  server.stderr.on('data', (c) => { serverErrors += c; });
  try {
    await waitUntilUp();
    // Лише асинхронно: підставний Gemini живе в цьому ж процесі й має відповідати під час тесту.
    // Python на Windows не розуміє TZ=Europe/Kyiv і рахував би час в UTC, тож браузер і тест розійшлися б.
    const pythonEnv = { ...env };
    if (process.platform === 'win32') delete pythonEnv.TZ;
    const code = await new Promise((resolve, reject) => {
      const python = spawn(PYTHON, ['-I', '-X', 'utf8', path.join(root, 'tests', 'e2e', file)], { cwd: root, env: pythonEnv, stdio: 'inherit' });
      python.on('error', reject);
      python.on('close', resolve);
    });
    // Сценарії з відмовою Gemini навмисні, тому їхні рядки в лозі не вважаємо помилкою.
    const unexpected = serverErrors.split('\n').filter((line) => line.trim() && !line.startsWith('Gemini ')).join('\n');
    if (unexpected) {
      console.error(`Помилки сервера під час ${file}:\n${unexpected}`);
      return false;
    }
    return code === 0;
  } finally {
    server.kill();
  }
}

const gemini = await startFakeGemini();
const telegram = await startFakeTelegram();
const uploads = mkdtempSync(path.join(tmpdir(), 'bs-uploads-'));
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DB_NAME: TEST_DB,
  PORT,
  HOST: '127.0.0.1',
  UPLOAD_DIR: uploads,
  // За замовчуванням файли лежать у базі, як у проді. Низький ліміт дозволяє перевірити переповнення.
  FILE_STORAGE: process.env.FILE_STORAGE || 'db',
  DB_FILES_LIMIT_MB: '40',
  JWT_SECRET: 'test-secret-only-for-e2e',
  COOKIE_SECURE: 'false',
  GEMINI_API_KEY: 'test-key',
  GEMINI_BASE_URL: `http://127.0.0.1:${gemini.address().port}`,
  GEMINI_MODELS: 'gemini-flash-latest,gemini-flash-lite-latest',
  TELEGRAM_BOT_TOKEN: 'test-bot',
  TELEGRAM_CHAT_ID: '42',
  TELEGRAM_API_BASE: `http://127.0.0.1:${telegram.address().port}`,
  SHOTS: process.env.SHOTS || path.join(root, 'tests', 'e2e', 'shots'),
};

const wanted = process.argv.slice(2);
const suites = readdirSync(path.join(root, 'tests', 'e2e'))
  .filter((f) => f.endsWith('.py') && (!wanted.length || wanted.includes(f.replace('.py', ''))));
if (!suites.length) throw new Error(`Немає таких наборів: ${wanted.join(', ')}`);

await ensureBucket(env);
const failed = [];
try {
  for (const file of suites) {
    console.log(`\n===== ${file}`);
    if (!(await runSuite(file, env))) failed.push(file);
  }
} finally {
  await dropTestDb(env);
  rmSync(uploads, { recursive: true, force: true });
  gemini.close();
  telegram.close();
}
console.log(failed.length ? `\nНе пройшли: ${failed.join(', ')}` : `\nУсі набори пройшли: ${suites.join(', ')}`);
process.exit(failed.length ? 1 : 0);
