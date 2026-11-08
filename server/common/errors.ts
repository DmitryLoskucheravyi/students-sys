import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { HttpError } from '../lib.js';

/**
 * Усі помилки йдуть клієнту як { error: текст }.
 * Власні помилки написані для людини. Текст непередбачених не показуємо, бо там можуть бути деталі бази.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(err: any, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    // Помилка посеред передачі файлу: відповідь уже почалася, лишається обірвати з'єднання.
    if (res.headersSent) {
      res.destroy();
      return;
    }
    let status: number;
    let message: string;
    if (err instanceof HttpError) {
      status = err.status;
      message = err.message;
    } else if (err instanceof HttpException) {
      status = err.getStatus();
      // Невідомий маршрут: Nest пише «Cannot GET ...», а клієнт чекає людський текст.
      message = status === 404 ? 'Не знайдено' : err.message;
    } else {
      status = err?.status ?? err?.statusCode ?? 500;
      message = err?.message ?? '';
    }
    const expected = err instanceof HttpError || status < 500;
    if (!expected) console.error(err);
    res.status(status).json({ error: expected ? message : 'Помилка сервера. Спробуйте ще раз.' });
  }
}
