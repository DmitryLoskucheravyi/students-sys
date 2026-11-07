import 'dotenv/config';
import mysql from 'mysql2/promise';

// Хмарний MySQL вимагає TLS. Сертифікат перевіряємо завжди: DB_SSL_CA містить CA провайдера.
const tls = process.env.DB_SSL === 'true'
  ? { ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}), rejectUnauthorized: true }
  : undefined;

export const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  ...(tls ? { ssl: tls } : {}),
};
export const dbName = process.env.DB_NAME || 'zoshyt';

// Дати зберігаються як локальний час школи і ходять рядками — без зсувів часових поясів.
export const pool = mysql.createPool({
  ...dbConfig,
  database: dbName,
  dateStrings: true,
  decimalNumbers: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  enableKeepAlive: true,
});

/** Зсув у форматі MySQL: хвилини на схід від UTC перетворює на +02:00. */
export function formatOffset(minutes) {
  const abs = Math.abs(minutes);
  return `${minutes < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/**
 * Запити використовують NOW() і CURDATE(), а база в хмарі живе в UTC, тож перед запитом
 * з'єднання переходить на час школи. Назву поясу передавати не можна: хмарний TiDB приймає
 * Europe/Kyiv, але падає на читанні таблиць. Зсув звіряємо щоразу, бо з'єднання живе довго
 * і може пережити перехід на літній час. Команда стає в чергу раніше за сам запит.
 */
if (process.env.TZ) {
  pool.on('acquire', (conn) => {
    const offset = formatOffset(-new Date().getTimezoneOffset());
    if (conn.schoolOffset === offset) return;
    conn.schoolOffset = offset;
    conn.query('SET time_zone = ?', [offset], () => {});
  });
}

export async function q(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(async (sql, params) => (await conn.query(sql, params))[0]);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
