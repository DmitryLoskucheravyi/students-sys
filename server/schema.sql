CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role ENUM('manager','teacher','student') NOT NULL,
  name VARCHAR(120) NOT NULL,
  login VARCHAR(40) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  token_version INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Кабінети вчителя: сервіс (Zoom, Google Meet...) і посилання. Обираються під час постановки в розклад.
CREATE TABLE IF NOT EXISTS teacher_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  service VARCHAR(60) NOT NULL,
  url VARCHAR(300) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,   -- підставляється, коли вчителя ставлять у розклад
  position INT NOT NULL DEFAULT 0,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rooms_teacher (teacher_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Курс: зміст навчання і роадмап. З абонементом не пов'язаний.
CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  summary VARCHAR(300) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roadmap_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(300) NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_steps_course (course_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roadmap_progress (
  student_id INT NOT NULL,
  step_id INT NOT NULL,
  done_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  marked_by INT NULL,
  PRIMARY KEY (student_id, step_id),
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES roadmap_steps(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Підпункти етапу. Етап вважається пройденим, коли позначено всі його підпункти.
CREATE TABLE IF NOT EXISTS roadmap_substeps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  step_id INT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  title VARCHAR(160) NOT NULL,
  FOREIGN KEY (step_id) REFERENCES roadmap_steps(id) ON DELETE CASCADE,
  INDEX idx_substeps_step (step_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roadmap_substep_progress (
  student_id INT NOT NULL,
  substep_id INT NOT NULL,
  done_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  marked_by INT NULL,
  PRIMARY KEY (student_id, substep_id),
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (substep_id) REFERENCES roadmap_substeps(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Абонемент-шаблон: кількість уроків і базова вартість заняття.
CREATE TABLE IF NOT EXISTS plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  lessons_count INT NOT NULL,
  price_per_lesson DECIMAL(10,2) NOT NULL,
  valid_days INT NOT NULL DEFAULT 30,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Абонемент учня: вартість заняття можна скоригувати окремо від шаблону.
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  plan_id INT NULL,
  name VARCHAR(120) NOT NULL,
  lessons_total INT NOT NULL,
  lessons_used INT NOT NULL DEFAULT 0,
  price_per_lesson DECIMAL(10,2) NOT NULL,
  starts_on DATE NOT NULL,
  expires_on DATE NOT NULL,
  status ENUM('active','closed') NOT NULL DEFAULT 'active',
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_subs_student (student_id, status, expires_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ручне списання уроків з абонемента: без заняття в розкладі. Ціна фіксується в момент списання.
CREATE TABLE IF NOT EXISTS subscription_writeoffs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL,
  lessons INT NOT NULL,
  price_per_lesson DECIMAL(10,2) NOT NULL,
  done_on DATE NOT NULL,
  note VARCHAR(300) NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_writeoffs_date (done_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Урок — шаблон: назва, курс, тривалість, місце. Хто веде, хто вчиться і коли — у lesson_schedules.
-- teacher_id: вчитель за замовчуванням, підставляється під час постановки в розклад.
-- lesson_students лишилася від старої моделі: з неї переноситься склад під час міграції.
CREATE TABLE IF NOT EXISTS lessons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  course_id INT NULL,
  teacher_id INT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  location VARCHAR(200) NULL,
  note VARCHAR(500) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (teacher_id) REFERENCES users(id),
  INDEX idx_lessons_teacher (teacher_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_students (
  lesson_id INT NOT NULL,
  student_id INT NOT NULL,
  PRIMARY KEY (lesson_id, student_id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ls_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Постановка уроку в розклад: постійно (дні тижня) або одноразово, зі своїм вчителем і учнями.
CREATE TABLE IF NOT EXISTS lesson_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lesson_id INT NOT NULL,
  teacher_id INT NULL,
  kind ENUM('weekly','once') NOT NULL,
  weekday TINYINT NULL,            -- старі записи: один день, 1 = Пн ... 7 = Нд
  weekdays VARCHAR(20) NULL,       -- дні постановки через кому, напр. "1,4"
  room_id INT NULL,                -- кабінет вчителя: його посилання стає місцем занять
  start_time TIME NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  materialized_until DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (room_id) REFERENCES teacher_rooms(id) ON DELETE SET NULL,
  INDEX idx_schedules_teacher (teacher_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedule_students (
  schedule_id INT NOT NULL,
  student_id INT NOT NULL,
  PRIMARY KEY (schedule_id, student_id),
  FOREIGN KEY (schedule_id) REFERENCES lesson_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ss_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Конкретне заняття в календарі. Скасування і перенесення змінюють лише його.
CREATE TABLE IF NOT EXISTS lesson_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lesson_id INT NOT NULL,
  schedule_id INT NOT NULL,
  original_starts_at DATETIME NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  status ENUM('scheduled','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  cancel_reason VARCHAR(300) NULL,
  location VARCHAR(200) NULL,      -- місце чи посилання лише цього заняття; порожньо: місце з уроку
  completed_at DATETIME NULL,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (schedule_id) REFERENCES lesson_schedules(id) ON DELETE CASCADE,
  UNIQUE KEY uq_occurrence (schedule_id, original_starts_at),
  INDEX idx_sessions_time (starts_at, status),
  INDEX idx_sessions_lesson (lesson_id, starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Відвідування і списання: ціна фіксується на момент заняття.
CREATE TABLE IF NOT EXISTS attendance (
  session_id INT NOT NULL,
  student_id INT NOT NULL,
  attended TINYINT(1) NOT NULL,
  subscription_id INT NULL,
  price_charged DECIMAL(10,2) NULL,
  PRIMARY KEY (session_id, student_id),
  FOREIGN KEY (session_id) REFERENCES lesson_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  INDEX idx_att_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Запит учня на скасування або перенесення.
CREATE TABLE IF NOT EXISTS session_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  student_id INT NOT NULL,
  kind ENUM('cancel','reschedule') NOT NULL,
  reason VARCHAR(300) NULL,
  proposed_starts_at DATETIME NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  resolved_by INT NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES lesson_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_req_status (status, session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Домашнє належить постановці: його бачать лише учні цієї групи.
CREATE TABLE IF NOT EXISTS homework (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lesson_id INT NOT NULL,
  schedule_id INT NULL,
  session_id INT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  due_at DATETIME NOT NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (schedule_id) REFERENCES lesson_schedules(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES lesson_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_hw_lesson (lesson_id, due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  homework_id INT NOT NULL,
  student_id INT NOT NULL,
  comment TEXT NULL,
  status ENUM('submitted','returned','accepted') NOT NULL DEFAULT 'submitted',
  grade TINYINT NULL,
  feedback TEXT NULL,
  submitted_at DATETIME NOT NULL,
  reviewed_at DATETIME NULL,
  reviewed_by INT NULL,
  UNIQUE KEY uq_submission (homework_id, student_id),
  FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submission_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  kind ENUM('file','archive','screenshot') NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(80) NOT NULL,
  mime VARCHAR(120) NULL,
  size BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Вміст файлів домашніх у проді: диск безкоштовного хостингу стирається під час рестарту.
-- Файл ділиться на частини: TiDB не приймає рядок більше 6 МБ.
CREATE TABLE IF NOT EXISTS file_chunks (
  stored_name VARCHAR(80) NOT NULL,
  part INT NOT NULL,
  gzipped TINYINT(1) NOT NULL,
  stored_size INT NOT NULL,
  data MEDIUMBLOB NOT NULL,
  PRIMARY KEY (stored_name, part)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
