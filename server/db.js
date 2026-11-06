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

/**
 * Запити використовують NOW() і CURDATE(), а база в хмарі живе в UTC. Коли задано TZ,
 * кожне з'єднання переводимо на час школи. Числовий пояс ставимо першим, бо таблиць
 * із назвами поясів у MySQL може не бути; команди йдуть чергою раніше за будь-який запит.
 */
if (process.env.TZ) {
  pool.on('connection', (conn) => {
    const minutes = -new Date().getTimezoneOffset();
    const abs = Math.abs(minutes);
    const offset = `${minutes < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
    conn.query('SET time_zone = ?', [offset], () => {});
    conn.query('SET time_zone = ?', [process.env.TZ], () => {});
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
