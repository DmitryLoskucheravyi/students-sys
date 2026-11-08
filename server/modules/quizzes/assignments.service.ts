import { Injectable } from '@nestjs/common';
import { bad, conflict, forbidden, id, notFound } from '../../lib.js';
import type { User } from '../../common/auth.js';
import { QuizRepository } from './quiz.repository.js';
import { grade, withMarks } from './quiz-grading.js';
import { parseAssignmentInput } from './quiz-input.js';
import { assertOwnerOrManager } from './quiz-policy.js';

/** Призначення тесту учневі: відкриття, правки, ще одна спроба, проходження. Одна спроба; бал рахується на сервері. */
@Injectable()
export class AssignmentsService {
  constructor(private readonly repo: QuizRepository) {}

  /** Учень: свої тести. */
  my(user: User) {
    return this.repo.assignmentsOfStudent(user.id);
  }

  async assign(user: User, quizValue: unknown, body: any) {
    const quiz = await this.repo.quiz(id(quizValue));
    if (quiz.status !== 'approved') throw bad('Тест ще не схвалено');
    const studentId = id(body?.student_id, 'Учень');
    if (!(await this.repo.isActiveStudent(studentId))) throw bad('Учня не знайдено');
    if (!(await this.repo.questionCount(quiz.id))) throw bad('У тесті немає питань');
    const { courseId, dueAt } = await this.parse(body);
    if (await this.repo.findAssignment(quiz.id, studentId)) throw conflict('Цей тест уже відкрито учневі');
    return { id: await this.repo.createAssignment({ quizId: quiz.id, studentId, courseId, dueAt, assignedBy: user.id }) };
  }

  async update(aidValue: unknown, body: any) {
    const a = await this.repo.assignment(id(aidValue));
    const { courseId, dueAt } = await this.parse(body);
    await this.repo.updateAssignment(a.id, courseId, dueAt);
    return { ok: true };
  }

  async remove(aidValue: unknown) {
    if (!(await this.repo.removeAssignment(id(aidValue)))) throw notFound('Тест не знайдено');
    return { ok: true };
  }

  /** Ще одна спроба: відповіді й бал стираються, тест знову чекає на учня. */
  async reset(aidValue: unknown) {
    const a = await this.repo.assignment(id(aidValue));
    await this.repo.resetAssignment(a.id);
    return { ok: true };
  }

  async get(user: User, aidValue: unknown) {
    const a = await this.repo.assignment(id(aidValue));
    assertOwnerOrManager(user, a);
    const done = Boolean(a.submitted_at);
    // Правильні відповіді учень бачить лише після здачі.
    const questions = await this.repo.questions(a.quiz_id, { withCorrect: done || user.role === 'manager' });
    const picks = done ? await this.repo.answers(a.id) : [];
    return { ...a, questions: withMarks(questions, picks, { marks: done }) };
  }

  async submit(user: User, aidValue: unknown, body: any) {
    const a = await this.repo.assignment(id(aidValue));
    if (a.student_id !== user.id) throw forbidden();
    const questions = await this.repo.questions(a.quiz_id, { withCorrect: true });
    const { picks, score } = grade(questions, body?.answers);
    if (!(await this.repo.record(a.id, picks, score, questions.length))) throw conflict('Тест уже пройдено');
    return { score, max_score: questions.length };
  }

  private async parse(body: any) {
    const input = parseAssignmentInput(body);
    if (input.courseId && !(await this.repo.courseExists(input.courseId))) throw bad('Курс не знайдено');
    return input;
  }
}
