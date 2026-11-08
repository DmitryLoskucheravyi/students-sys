import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { dbConfig, dbName } from './db.js';
import { ROOT } from './paths.js';

async function tableExists(conn: Connection, table: string): Promise<boolean> {
  const [[{ n }]] = await conn.query<RowDataPacket[]>(
    'SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
    [dbName, table]
  );
  return n > 0;
}
async function columnInfo(conn: Connection, table: string, column: string): Promise<{ nullable: string } | null> {
  const [[row]] = await conn.query<RowDataPacket[]>(
    `SELECT IS_NULLABLE AS nullable FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [dbName, table, column]
  );
  return (row as { nullable: string } | undefined) ?? null;
}

/**
 * Старі бази. Кожен крок виконується один раз: лише коли його колонки чи таблиці ще немає.
 * Вчитель і учні колись належали уроку, тепер постановці в розклад. Склад копіюється
 * в кожну постановку того самого уроку, домашнє переходить до постановки свого заняття.
 */
async function migrate(conn: Connection, { hadRoster, hadSchedules }: { hadRoster: boolean; hadSchedules: boolean }): Promise<void> {
  const lessonTeacher = await columnInfo(conn, 'lessons', 'teacher_id');
  if (lessonTeacher?.nullable === 'NO') await conn.query('ALTER TABLE lessons MODIFY teacher_id INT NULL');

  if (!(await columnInfo(conn, 'lesson_schedules', 'teacher_id'))) {
    await conn.query('ALTER TABLE lesson_schedules ADD COLUMN teacher_id INT NULL, ADD COLUMN weekdays VARCHAR(20) NULL');
    await conn.query('ALTER TABLE lesson_schedules ADD CONSTRAINT fk_schedules_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL');
    await conn.query('ALTER TABLE lesson_schedules ADD INDEX idx_schedules_teacher (teacher_id, is_active)');
    await conn.query('UPDATE lesson_schedules sc JOIN lessons l ON l.id = sc.lesson_id SET sc.teacher_id = l.teacher_id');
    await conn.query(`UPDATE lesson_schedules SET weekdays = CAST(weekday AS CHAR) WHERE kind = 'weekly' AND weekday IS NOT NULL`);
  }
  if (!(await columnInfo(conn, 'teacher_rooms', 'is_default'))) {
    await conn.query('ALTER TABLE teacher_rooms ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0');
  }
  if (!(await columnInfo(conn, 'lesson_schedules', 'room_id'))) {
    await conn.query('ALTER TABLE lesson_schedules ADD COLUMN room_id INT NULL');
    await conn.query('ALTER TABLE lesson_schedules ADD CONSTRAINT fk_schedules_room FOREIGN KEY (room_id) REFERENCES teacher_rooms(id) ON DELETE SET NULL');
  }
  if (!(await columnInfo(conn, 'lesson_sessions', 'location'))) {
    await conn.query('ALTER TABLE lesson_sessions ADD COLUMN location VARCHAR(200) NULL');
  }
  // Аватарка з готового набору.
  if (!(await columnInfo(conn, 'users', 'avatar'))) {
    await conn.query('ALTER TABLE users ADD COLUMN avatar VARCHAR(32) NULL');
  }
  // Вигляд курсу: іконка й колірна тема. Порожні значення означають шкільний стандарт.
  if (!(await columnInfo(conn, 'courses', 'icon'))) {
    await conn.query('ALTER TABLE courses ADD COLUMN icon VARCHAR(20) NULL, ADD COLUMN theme VARCHAR(20) NULL');
  }
  // Учень бачить сповіщення про оцінку чи відгук, доки не відкриє роботу.
  if (!(await columnInfo(conn, 'submissions', 'seen_at'))) {
    await conn.query('ALTER TABLE submissions ADD COLUMN seen_at DATETIME NULL');
    await conn.query('UPDATE submissions SET seen_at = reviewed_at WHERE reviewed_at IS NOT NULL');
  }
  // Домашнє до теми роадмапу: без уроку, з курсом і, якщо задав вчитель, з ним.
  if ((await columnInfo(conn, 'homework', 'lesson_id'))?.nullable === 'NO') {
    await conn.query('ALTER TABLE homework MODIFY lesson_id INT NULL');
  }
  if (!(await columnInfo(conn, 'homework', 'course_id'))) {
    await conn.query('ALTER TABLE homework ADD COLUMN course_id INT NULL, ADD COLUMN teacher_id INT NULL');
    await conn.query('ALTER TABLE homework ADD CONSTRAINT fk_homework_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE');
    await conn.query('ALTER TABLE homework ADD CONSTRAINT fk_homework_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL');
  }
  // Модерація тестів: старі тести вважаються схваленими.
  if (!(await columnInfo(conn, 'quizzes', 'status'))) {
    await conn.query("ALTER TABLE quizzes ADD COLUMN status ENUM('approved','pending','rejected') NOT NULL DEFAULT 'approved', ADD COLUMN review_note VARCHAR(300) NULL");
  }
  // Публічне посилання на тест.
  if (!(await columnInfo(conn, 'quizzes', 'share_token'))) {
    // TiDB не вміє додати колонку разом з UNIQUE: індекс окремим кроком.
    await conn.query('ALTER TABLE quizzes ADD COLUMN share_token VARCHAR(32) NULL');
    await conn.query('CREATE UNIQUE INDEX uq_quizzes_share ON quizzes (share_token)');
  }
  // Колір виду абонемента: ним фарбується квиток учня.
  if (!(await columnInfo(conn, 'plans', 'color'))) {
    await conn.query("ALTER TABLE plans ADD COLUMN color VARCHAR(16) NOT NULL DEFAULT 'red'");
  }
  // «Продано» — сума в момент видачі абонемента. Для старих записів беремо поточну.
  if (!(await columnInfo(conn, 'subscriptions', 'sold_amount'))) {
    await conn.query('ALTER TABLE subscriptions ADD COLUMN sold_amount DECIMAL(10,2) NULL');
    await conn.query('UPDATE subscriptions SET sold_amount = lessons_total * price_per_lesson');
  }
  // Запізнення рахується від першої здачі.
  if (!(await columnInfo(conn, 'submissions', 'first_submitted_at'))) {
    await conn.query('ALTER TABLE submissions ADD COLUMN first_submitted_at DATETIME NULL');
    await conn.query('UPDATE submissions SET first_submitted_at = submitted_at');
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

export async function ensureDatabase(): Promise<void> {
  const conn = await mysql.createConnection({ ...dbConfig, multipleStatements: true });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${dbName}\``);
    const hadRoster = await tableExists(conn, 'schedule_students');
    const hadSchedules = await tableExists(conn, 'lesson_schedules');
    await conn.query(await readFile(path.join(ROOT, 'server', 'schema.sql'), 'utf8'));
    await migrate(conn, { hadRoster, hadSchedules });
    const [[{ n }]] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) n FROM users WHERE role='manager'`);
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
