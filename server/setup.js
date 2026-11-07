import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { dbConfig, dbName } from './db.js';

export async function ensureDatabase() {
  const conn = await mysql.createConnection({ ...dbConfig, multipleStatements: true });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${dbName}\``);
    await conn.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    // Старі бази: урок раніше вимагав вчителя одразу, тепер його додають пізніше.
    const [[col]] = await conn.query(
      `SELECT IS_NULLABLE AS nullable FROM information_schema.columns
        WHERE table_schema = ? AND table_name = 'lessons' AND column_name = 'teacher_id'`,
      [dbName]
    );
    if (col?.nullable === 'NO') await conn.query('ALTER TABLE lessons MODIFY teacher_id INT NULL');
    const [[{ n }]] = await conn.query(`SELECT COUNT(*) n FROM users WHERE role='manager'`);
    if (n === 0) {
      const production = process.env.NODE_ENV === 'production';
      const password = process.env.INITIAL_MANAGER_PASSWORD || (production ? '' : 'manager123');
      if (password.length < 8) {
        throw new Error('Вкажіть INITIAL_MANAGER_PASSWORD (від 8 символів): у проді немає пароля за замовчуванням.');
      }
      const hash = await bcrypt.hash(password, 10);
      await conn.query(
        `INSERT INTO users (role, name, login, password_hash) VALUES ('manager', 'Менеджер', 'manager', ?)`,
        [hash]
      );
      console.log(production ? 'Створено менеджера з логіном manager.' : 'Створено менеджера: manager / manager123. Змініть пароль після першого входу.');
    }
  } finally {
    await conn.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await ensureDatabase();
  console.log(`База ${dbName} готова.`);
  process.exit(0);
}
