import { Injectable } from '@nestjs/common';
import type { User } from '../../common/auth.js';
import { QuizRepository } from './quiz.repository.js';
import { grade, withMarks } from './quiz-grading.js';

/**
 * Тест за публічним посиланням. Пройти може будь-хто, навіть без входу.
 * Учень, що увійшов, отримує запис у своїх тестах (одна спроба); решта просто бачить результат, нічого не зберігається.
 */
@Injectable()
export class PublicQuizzesService {
  constructor(private readonly repo: QuizRepository) {}

  async get(user: User | null, token: string) {
    const quiz = await this.repo.sharedQuiz(token);
    return {
      title: quiz.title,
      description: quiz.description,
      questions: await this.repo.questions(quiz.id, { withCorrect: false }),
      mine: user?.role === 'student' ? await this.repo.findAssignment(quiz.id, user.id) : null,
    };
  }

  async check(user: User | null, token: string, body: any) {
    const quiz = await this.repo.sharedQuiz(token);
    const questions = await this.repo.questions(quiz.id, { withCorrect: true });
    const { picks, score } = grade(questions, body?.answers);
    const saved = user?.role === 'student' ? await this.recordFor(user, quiz.id, picks, score, questions.length) : null;
    return {
      score,
      max_score: questions.length,
      recorded: saved?.recorded ?? false,
      already: saved ? !saved.recorded : false,
      assignment_id: saved?.assignmentId ?? null,
      questions: withMarks(questions, picks),
    };
  }

  /** Учневі записується лише перша спроба: призначення створюється, якщо його ще немає. */
  private async recordFor(user: User, quizId: number, picks: Parameters<QuizRepository['record']>[1], score: number, max: number) {
    const assignmentId = (await this.repo.findAssignment(quizId, user.id))?.id ?? await this.repo.createAssignment({ quizId, studentId: user.id });
    return { assignmentId, recorded: await this.repo.record(assignmentId, picks, score, max) };
  }
}
