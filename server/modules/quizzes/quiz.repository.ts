import { Injectable } from '@nestjs/common';
import { type Query, type Row, q, tx } from '../../db.js';
import { bad, notFound, nowStr } from '../../lib.js';
import { removeFile } from '../../storage.js';
import type { LoadedQuestion, Pick } from './quiz-grading.js';
import type { QuestionInput } from './quiz-input.js';

/** Доступ до даних тестів: усі SQL-запити тестів, призначень і картинок тут. Сервіси лише вирішують, що робити. */
@Injectable()
export class QuizRepository {
  static readonly ASSIGN_SELECT = `
    SELECT a.id, a.quiz_id, a.student_id, a.course_id, a.due_at, a.created_at, a.submitted_at, a.score, a.max_score,
           z.title AS quiz_title, z.description, u.name AS student_name, u.avatar AS student_avatar, c.title AS course_title,
           (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id = a.quiz_id) AS questions_count
      FROM quiz_assignments a
      JOIN quizzes z ON z.id = a.quiz_id
      JOIN users u ON u.id = a.student_id
      LEFT JOIN courses c ON c.id = a.course_id`;

  /* ---------- тести ---------- */

  async quiz(quizId: number): Promise<Row> {
    const [quiz] = await q('SELECT z.*, u.name AS author_name FROM quizzes z LEFT JOIN users u ON u.id = z.created_by WHERE z.id=?', [quizId]);
    if (!quiz) throw notFound('Тест не знайдено');
    return quiz;
  }

  /** Тест за публічним посиланням: лише схвалений. */
  async sharedQuiz(token: string): Promise<Row> {
    if (!/^[A-Za-z0-9_-]{8,32}$/.test(token)) throw notFound('Посилання недійсне');
    const [quiz] = await q("SELECT id, title, description FROM quizzes WHERE share_token=? AND status='approved'", [token]);
    if (!quiz) throw notFound('Посилання недійсне або тест закрито');
    return quiz;
  }

  list(authorId: number | null): Promise<Row[]> {
    return q(
      `SELECT z.*, u.name AS author_name, u.role AS author_role,
          (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id = z.id) AS questions_count,
          (SELECT COUNT(*) FROM quiz_assignments a WHERE a.quiz_id = z.id) AS assigned_count,
          (SELECT COUNT(*) FROM quiz_assignments a WHERE a.quiz_id = z.id AND a.submitted_at IS NOT NULL) AS done_count
         FROM quizzes z LEFT JOIN users u ON u.id = z.created_by
        ${authorId ? 'WHERE z.created_by = ?' : ''}
        ORDER BY z.updated_at DESC, z.id DESC`,
      authorId ? [authorId] : []
    );
  }

  async create(fields: { title: string; description: string | null; status: string; createdBy: number }, questions: QuestionInput[]): Promise<number> {
    return tx(async (t) => {
      const r = await t('INSERT INTO quizzes (title, description, status, created_by) VALUES (?,?,?,?)', [fields.title, fields.description, fields.status, fields.createdBy]);
      await this.saveQuestions(t, r.insertId, questions);
      return r.insertId as number;
    });
  }

  async update(quizId: number, fields: { title: string; description: string | null; status: string }, questions: QuestionInput[]): Promise<void> {
    await tx(async (t) => {
      await t('UPDATE quizzes SET title=?, description=?, status=?, updated_at=? WHERE id=?', [fields.title, fields.description, fields.status, nowStr(), quizId]);
      await this.saveQuestions(t, quizId, questions);
    });
  }

  async remove(quizId: number): Promise<void> {
    await q('DELETE FROM quizzes WHERE id=?', [quizId]);
  }

  async setStatus(quizId: number, status: string, note: string | null = null): Promise<void> {
    await q('UPDATE quizzes SET status=?, review_note=? WHERE id=?', [status, note, quizId]);
  }

  async setShareToken(quizId: number, token: string | null): Promise<void> {
    await q('UPDATE quizzes SET share_token=? WHERE id=?', [token, quizId]);
  }

  async pendingCount(): Promise<number> {
    const [{ n }] = await q("SELECT COUNT(*) AS n FROM quizzes WHERE status='pending'");
    return Number(n);
  }

  /* ---------- питання ---------- */

  async questions(quizId: number, { withCorrect }: { withCorrect: boolean }): Promise<LoadedQuestion[]> {
    const questions: Row[] = await q('SELECT id, text, image FROM quiz_questions WHERE quiz_id=? ORDER BY position, id', [quizId]);
    const options: Row[] = questions.length
      ? await q('SELECT id, question_id, text, is_correct FROM quiz_options WHERE question_id IN (?) ORDER BY position, id', [questions.map((x) => x.id)])
      : [];
    return questions.map((x) => {
      const own = options.filter((o) => o.question_id === x.id);
      return {
        id: x.id,
        text: x.text,
        image: x.image,
        // Учень бачить, що правильних кілька, лише як підказку до типу відповіді.
        multiple: own.filter((o) => o.is_correct).length > 1,
        options: own.map((o) => (withCorrect ? { id: o.id, text: o.text, correct: Boolean(o.is_correct) } : { id: o.id, text: o.text })),
      };
    });
  }

  async questionCount(quizId: number): Promise<number> {
    const [{ n }] = await q('SELECT COUNT(*) n FROM quiz_questions WHERE quiz_id=?', [quizId]);
    return Number(n);
  }

  /**
   * Записує питання тесту. Наявні оновлюються за id, нові додаються, зайві видаляються:
   * так відповіді вже пройдених спроб лишаються прив'язаними до тих самих питань.
   */
  private async saveQuestions(t: Query, quizId: number, questions: QuestionInput[]): Promise<void> {
    const images = [...new Set(questions.map((x) => x.image).filter(Boolean))];
    if (images.length) {
      const found = await t('SELECT stored_name FROM quiz_images WHERE stored_name IN (?)', [images]);
      if (found.length !== images.length) throw bad('Картинку не знайдено. Завантажте її ще раз.');
    }
    const oldIds = new Set(((await t('SELECT id FROM quiz_questions WHERE quiz_id=?', [quizId])) as Row[]).map((r) => r.id));
    const keptQ: number[] = [];
    for (const [i, x] of questions.entries()) {
      let qid = x.id && oldIds.has(x.id) ? x.id : null;
      if (qid) await t('UPDATE quiz_questions SET position=?, text=?, image=? WHERE id=?', [i + 1, x.text, x.image, qid]);
      else qid = (await t('INSERT INTO quiz_questions (quiz_id, position, text, image) VALUES (?,?,?,?)', [quizId, i + 1, x.text, x.image])).insertId as number;
      keptQ.push(qid);
      const oldO = new Set(((await t('SELECT id FROM quiz_options WHERE question_id=?', [qid])) as Row[]).map((r) => r.id));
      const keptO: number[] = [];
      for (const [k, o] of x.options.entries()) {
        if (o.id && oldO.has(o.id)) {
          await t('UPDATE quiz_options SET position=?, text=?, is_correct=? WHERE id=?', [k + 1, o.text, o.correct ? 1 : 0, o.id]);
          keptO.push(o.id);
        } else {
          keptO.push((await t('INSERT INTO quiz_options (question_id, position, text, is_correct) VALUES (?,?,?,?)', [qid, k + 1, o.text, o.correct ? 1 : 0])).insertId);
        }
      }
      await t('DELETE FROM quiz_options WHERE question_id=? AND id NOT IN (?)', [qid, keptO]);
    }
    await t('DELETE FROM quiz_questions WHERE quiz_id=? AND id NOT IN (?)', [quizId, keptQ]);
  }

  /* ---------- призначення ---------- */

  async assignment(assignmentId: number): Promise<Row> {
    const [a] = await q(`${QuizRepository.ASSIGN_SELECT} WHERE a.id=?`, [assignmentId]);
    if (!a) throw notFound('Тест не знайдено');
    return a;
  }

  assignmentsOfStudent(studentId: number): Promise<Row[]> {
    return q(`${QuizRepository.ASSIGN_SELECT} WHERE a.student_id=? ORDER BY a.submitted_at IS NOT NULL, a.created_at DESC`, [studentId]);
  }

  assignmentsOfQuiz(quizId: number): Promise<Row[]> {
    return q(`${QuizRepository.ASSIGN_SELECT} WHERE a.quiz_id=? ORDER BY u.name`, [quizId]);
  }

  async findAssignment(quizId: number, studentId: number): Promise<Row | null> {
    const [a] = await q('SELECT id, submitted_at, score, max_score FROM quiz_assignments WHERE quiz_id=? AND student_id=?', [quizId, studentId]);
    return a ?? null;
  }

  async createAssignment(fields: { quizId: number; studentId: number; courseId?: number | null; dueAt?: string | null; assignedBy?: number | null }): Promise<number> {
    const r = await q('INSERT INTO quiz_assignments (quiz_id, student_id, course_id, due_at, assigned_by) VALUES (?,?,?,?,?)', [
      fields.quizId, fields.studentId, fields.courseId ?? null, fields.dueAt ?? null, fields.assignedBy ?? null,
    ]);
    return r.insertId as number;
  }

  async updateAssignment(assignmentId: number, courseId: number | null, dueAt: string | null): Promise<void> {
    await q('UPDATE quiz_assignments SET course_id=?, due_at=? WHERE id=?', [courseId, dueAt, assignmentId]);
  }

  async removeAssignment(assignmentId: number): Promise<boolean> {
    const r = await q('DELETE FROM quiz_assignments WHERE id=?', [assignmentId]);
    return r.affectedRows > 0;
  }

  async resetAssignment(assignmentId: number): Promise<void> {
    await tx(async (t) => {
      await t('DELETE FROM quiz_answers WHERE assignment_id=?', [assignmentId]);
      await t('UPDATE quiz_assignments SET submitted_at=NULL, score=NULL, max_score=NULL WHERE id=?', [assignmentId]);
    });
  }

  answers(assignmentId: number): Promise<Pick[]> {
    return q('SELECT question_id, option_id FROM quiz_answers WHERE assignment_id=?', [assignmentId]);
  }

  /** Записує здачу. Повертає false, якщо спробу вже записано раніше. */
  async record(assignmentId: number, picks: Pick[], score: number, max: number): Promise<boolean> {
    return tx(async (t) => {
      const [cur] = await t('SELECT submitted_at FROM quiz_assignments WHERE id=? FOR UPDATE', [assignmentId]);
      if (cur.submitted_at) return false;
      if (picks.length) await t('INSERT INTO quiz_answers (assignment_id, question_id, option_id) VALUES ?', [picks.map((p) => [assignmentId, p.question_id, p.option_id])]);
      await t('UPDATE quiz_assignments SET submitted_at=?, score=?, max_score=? WHERE id=?', [nowStr(), score, max, assignmentId]);
      return true;
    });
  }

  async openCount(studentId: number): Promise<number> {
    const [{ n }] = await q('SELECT COUNT(*) AS n FROM quiz_assignments WHERE student_id=? AND submitted_at IS NULL', [studentId]);
    return Number(n);
  }

  async isActiveStudent(userId: number): Promise<boolean> {
    const [s] = await q(`SELECT id FROM users WHERE id=? AND role='student' AND is_active=1`, [userId]);
    return Boolean(s);
  }

  async courseExists(courseId: number): Promise<boolean> {
    const [c] = await q('SELECT id FROM courses WHERE id=?', [courseId]);
    return Boolean(c);
  }

  /* ---------- картинки ---------- */

  async image(name: string): Promise<Row | null> {
    const [img] = await q('SELECT * FROM quiz_images WHERE stored_name=?', [name]);
    return img ?? null;
  }

  async addImage(name: string, mime: string, size: number, createdBy: number): Promise<void> {
    await q('INSERT INTO quiz_images (stored_name, mime, size, created_by) VALUES (?,?,?,?)', [name, mime, size, createdBy]);
  }

  /** Учень бачить картинку лише з тесту, відкритого саме йому. */
  async imageOpenedTo(name: string, studentId: number): Promise<boolean> {
    const [hit] = await q('SELECT 1 FROM quiz_questions x JOIN quiz_assignments a ON a.quiz_id = x.quiz_id WHERE x.image=? AND a.student_id=? LIMIT 1', [name, studentId]);
    return Boolean(hit);
  }

  /** Вчитель бачить картинки, які сам завантажив або які стоять у його тестах. */
  async imageOfAuthor(name: string, authorId: number): Promise<boolean> {
    const [hit] = await q(
      `SELECT 1 FROM quiz_images i WHERE i.stored_name=? AND (i.created_by=?
          OR EXISTS (SELECT 1 FROM quiz_questions x JOIN quizzes z ON z.id = x.quiz_id WHERE x.image = i.stored_name AND z.created_by=?)) LIMIT 1`,
      [name, authorId, authorId]
    );
    return Boolean(hit);
  }

  async imageOfQuiz(name: string, quizId: number): Promise<Row | null> {
    const [img] = await q('SELECT i.* FROM quiz_images i JOIN quiz_questions x ON x.image = i.stored_name WHERE i.stored_name=? AND x.quiz_id=? LIMIT 1', [name, quizId]);
    return img ?? null;
  }

  /** Картинки, які ніде не використовуються вже добу: завантажили, але тест так і не зберегли. */
  async dropOrphanImages(): Promise<void> {
    const stale: Row[] = await q(
      `SELECT i.stored_name FROM quiz_images i
        WHERE i.created_at < NOW() - INTERVAL 1 DAY
          AND NOT EXISTS (SELECT 1 FROM quiz_questions x WHERE x.image = i.stored_name)`
    );
    for (const { stored_name: name } of stale) {
      await q('DELETE FROM quiz_images WHERE stored_name=?', [name]);
      await removeFile(name);
    }
  }
}
