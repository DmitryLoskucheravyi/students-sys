import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { bad, conflict, id, str } from '../../lib.js';
import type { User } from '../../common/auth.js';
import { HW_FOR } from '../../audience.js';
import { q } from '../../db.js';
import { QuizRepository } from './quiz.repository.js';
import { asNew, parseQuiz } from './quiz-input.js';
import { assertAuthor, initialStatus, statusAfterEdit } from './quiz-policy.js';

/*
 * Тести: створення, правки, модерація, публічне посилання.
 * Менеджер створює тест одразу в загальний список; тест вчителя чекає на схвалення, відхилений вчитель виправляє й надсилає знову.
 */
@Injectable()
export class QuizzesService {
  constructor(private readonly repo: QuizRepository) {}

  /** Менеджер бачить усі тести (модерація окремим списком), вчитель — власні. */
  list(user: User) {
    return this.repo.list(user.role === 'teacher' ? user.id : null);
  }

  async create(user: User, body: unknown) {
    const quiz = parseQuiz(body);
    const status = initialStatus(user);
    const quizId = await this.repo.create({ title: quiz.title, description: quiz.description, status, createdBy: user.id }, asNew(quiz.questions));
    await this.cleanImages();
    return { id: quizId, status };
  }

  async get(user: User, idValue: unknown) {
    const quiz = await this.repo.quiz(id(idValue));
    assertAuthor(user, quiz, { edit: false });
    return {
      ...quiz,
      questions: await this.repo.questions(quiz.id, { withCorrect: true }),
      assignments: user.role === 'manager' ? await this.repo.assignmentsOfQuiz(quiz.id) : [],
    };
  }

  async update(user: User, idValue: unknown, body: unknown) {
    const quiz = await this.repo.quiz(id(idValue));
    assertAuthor(user, quiz, { edit: true });
    const next = parseQuiz(body);
    await this.repo.update(quiz.id, { title: next.title, description: next.description, status: statusAfterEdit(user, quiz.status) }, next.questions);
    await this.cleanImages();
    return { ok: true };
  }

  async remove(user: User, idValue: unknown) {
    const quiz = await this.repo.quiz(id(idValue));
    assertAuthor(user, quiz, { edit: true });
    await this.repo.remove(quiz.id);
    return { ok: true };
  }

  /** Публічне посилання: вмикає (створює токен) або вимикає. Лише для схвалених тестів. */
  async share(user: User, idValue: unknown, on: boolean) {
    const quiz = await this.repo.quiz(id(idValue));
    assertAuthor(user, quiz, { edit: false });
    if (!on) {
      await this.repo.setShareToken(quiz.id, null);
      return { share_token: null };
    }
    if (quiz.status !== 'approved') throw bad('Поділитися можна лише схваленим тестом');
    const token = quiz.share_token ?? randomBytes(12).toString('base64url');
    if (!quiz.share_token) await this.repo.setShareToken(quiz.id, token);
    return { share_token: token };
  }

  async approve(idValue: unknown) {
    const quiz = await this.repo.quiz(id(idValue));
    await this.repo.setStatus(quiz.id, 'approved');
    return { ok: true };
  }

  async reject(idValue: unknown, body: any) {
    const quiz = await this.repo.quiz(id(idValue));
    if (quiz.status === 'approved') throw conflict('Тест уже схвалено');
    await this.repo.setStatus(quiz.id, 'rejected', str(body?.note, 'Причина', { max: 300, required: false }));
    return { ok: true };
  }

  /** Прибирання не має ламати збереження тесту: помилку лише записуємо в журнал. */
  private cleanImages() {
    return this.repo.dropOrphanImages().catch((e) => console.error(e));
  }
}

/** Лічильник у навігації. Учень: непройдені тести й нові відгуки до домашніх. Менеджер: тести на модерації. */
@Injectable()
export class NotificationsService {
  constructor(private readonly repo: QuizRepository) {}

  async count(user: User) {
    if (user.role === 'manager') {
      const pending = await this.repo.pendingCount();
      return { count: pending, quizzes: 0, reviews: 0, moderation: pending };
    }
    if (user.role !== 'student') return { count: 0, quizzes: 0, reviews: 0 };
    const quizzes = await this.repo.openCount(user.id);
    const [{ reviews }] = await q(
      // Лише домашні, задані учневі зараз: інакше роботу не відкрити, і сповіщення не згасне.
      `SELECT COUNT(*) AS reviews FROM submissions s JOIN homework h ON h.id = s.homework_id
        WHERE s.student_id=? AND s.reviewed_at IS NOT NULL AND s.seen_at IS NULL AND ${HW_FOR('h', 's.student_id')}`,
      [user.id]
    );
    return { count: quizzes + Number(reviews), quizzes, reviews: Number(reviews) };
  }
}
