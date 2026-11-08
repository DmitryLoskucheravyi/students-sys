import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import type { Request, Response } from 'express';
import multer from 'multer';
import type { Row } from '../../db.js';
import { bad, notFound } from '../../lib.js';
import { UPLOAD_DIR, persistFile } from '../../storage.js';
import { imageMime, readHead, sendStored } from '../../files.js';
import type { User } from '../../common/auth.js';
import { QuizRepository } from './quiz.repository.js';
import { IMAGE_NAME } from './quiz-input.js';

const MAX_IMAGE_MB = 5;
const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_req, _file, cb) => cb(null, `${randomUUID()}.bin`) }),
  limits: { fileSize: MAX_IMAGE_MB * 1024 * 1024, files: 1, fields: 0 },
}).single('image');

/** Картинки питань: завантаження й віддача з перевіркою, хто що може бачити. */
@Injectable()
export class QuizImagesService {
  constructor(private readonly repo: QuizRepository) {}

  async upload(user: User, req: Request, res: Response) {
    const err = await new Promise<unknown>((resolve) => upload(req, res, resolve));
    try {
      if (err) throw (err as multer.MulterError).code === 'LIMIT_FILE_SIZE' ? bad(`Картинка завелика: максимум ${MAX_IMAGE_MB} МБ`) : bad('Не вдалося завантажити картинку');
      if (!req.file) throw bad('Оберіть картинку');
      const mime = imageMime(await readHead(req.file.path));
      if (!mime) throw bad('Картинка: PNG, JPG, WEBP або GIF');
      await persistFile(req.file.filename);
      await this.repo.addImage(req.file.filename, mime, req.file.size, user.id);
      return { image: req.file.filename };
    } catch (e) {
      if (req.file) await unlink(req.file.path).catch(() => {});
      throw e;
    }
  }

  /** Учень — лише з відкритого йому тесту; вчитель — свої; менеджер — усі. */
  async send(user: User, name: string, res: Response) {
    if (!IMAGE_NAME.test(name)) throw notFound('Картинку не знайдено');
    const img = await this.repo.image(name);
    const allowed = img && (
      user.role === 'manager'
      || (user.role === 'student' && await this.repo.imageOpenedTo(name, user.id))
      || (user.role === 'teacher' && await this.repo.imageOfAuthor(name, user.id))
    );
    if (!allowed) throw notFound('Картинку не знайдено');
    await this.stream(res, img, 'private, max-age=86400');
  }

  /** Картинка тесту за публічним посиланням: лише з цього тесту. */
  async sendShared(token: string, name: string, res: Response) {
    const quiz = await this.repo.sharedQuiz(token);
    if (!IMAGE_NAME.test(name)) throw notFound('Картинку не знайдено');
    const img = await this.repo.imageOfQuiz(name, quiz.id);
    if (!img) throw notFound('Картинку не знайдено');
    await this.stream(res, img, 'public, max-age=86400');
  }

  private stream(res: Response, img: Row, cache: string) {
    return sendStored(res, { storedName: img.stored_name, mime: img.mime, size: img.size, filename: 'image', inline: true, cache }, 'Картинку не знайдено');
  }
}
