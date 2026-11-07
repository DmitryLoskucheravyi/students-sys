import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { dbConfig, dbName } from './db.js';

async function tableExists(conn, table) {
  const [[{ n }]] = await conn.query(
    'SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
    [dbName, table]
  );
  return n > 0;
}
async function columnInfo(conn, table, column) {
  const [[row]] = await conn.query(
    `SELECT IS_NULLABLE AS nullable FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [dbName, table, column]
  );
  return row ?? null;
}

/**
 * Старі бази. Кожен крок виконується один раз: лише коли його колонки чи таблиці ще немає.
 * Вчитель і учні колись належали уроку, тепер постановці в розклад. Склад копіюється
 * в кожну постановку того самого уроку, домашнє переходить до постановки свого заняття.
 */
async function migrate(conn, { hadRoster, hadSchedules }) {
  const lessonTeacher = await columnInfo(conn, 'lessons', 'teacher_id');
  if (lessonTeacher?.nullable === 'NO') await conn.query('ALTER TABLE lessons MODIFY teacher_id INT NULL');

  if (!(await columnInfo(conn, 'lesson_schedules', 'teacher_id'))) {
    await conn.query('ALTER TABLE lesson_schedules ADD COLUMN teacher_id INT NULL, ADD COLUMN weekdays VARCHAR(20) NULL');
    await conn.query('ALTER TABLE lesson_schedules ADD CONSTRAINT fk_schedules_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL');
    await conn.query('ALTER TABLE lesson_schedules ADD INDEX idx_schedules_teacher (teacher_id, is_active)');
    await conn.query('UPDATE lesson_schedules sc JOIN lessons l ON l.id = sc.lesson_id SET sc.teacher_id = l.teacher_id');
    await conn.query(`UPDATE lesson_schedules SET weekdays = CAST(weekday AS CHAR) WHERE kind = 'weekly' AND weekday IS NOT NULL`);
  }
  if (!(await columnInfo(conn, 'lesson_sessions', 'location'))) {
    await conn.query('ALTER TABLE lesson_sessions ADD COLUMN location VARCHAR(200) NULL');
  }
  if (hadSchedules && !hadRoster) {
    await conn.query(
      `INSERT IGNORE INTO schedule_students (schedule_id, student_id)
       SELECT sc.id, ls.student_id FROM lesson_schedules sc JOIN lesson_students ls ON ls.lesson_id = sc.lesson_id`
    );
  }
  if (!(await columnInfo(conn, 'homework', 'schedule_id'))) {
    await conn.query('ALTER TABLE homework ADD COLUMN schedule_id INT NULL');
    await conn.query('ALTER TABLE homework ADD CONSTRAINT fk_homework_schedule FOREIGN KEY (schedule_id) REFERENCES lesson_schedules(id) ON DELETE SET NULL');
    await conn.query('UPDATE homework h JOIN lesson_sessions se ON se.id = h.session_id SET h.schedule_id = se.schedule_id');
    await conn.query(
      `UPDATE homework h SET h.schedule_id = (SELECT MIN(sc.id) FROM lesson_schedules sc WHERE sc.lesson_id = h.lesson_id)
        WHERE h.schedule_id IS NULL`
    );
  }
}

export async function ensureDatabase() {
  const conn = await mysql.createConnection({ ...dbConfig, multipleStatements: true });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${dbName}\``);
    const hadRoster = await tableExists(conn, 'schedule_students');
    const hadSchedules = await tableExists(conn, 'lesson_schedules');
    await conn.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    await migrate(conn, { hadRoster, hadSchedules });
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
