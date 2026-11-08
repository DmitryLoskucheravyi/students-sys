import { createReadStream } from 'node:fs';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { packFile, unpackFile } from './compress.js';
import { pool, q, type Row } from './db.js';
import { HttpError } from './lib.js';
import { ROOT } from './paths.js';
import type * as S3 from '@aws-sdk/client-s3';
import type { Upload as S3Upload } from '@aws-sdk/lib-storage';

/**
 * Файли домашніх. Диск безкоштовного хостингу стирається під час кожного рестарту,
 * тому в проді вони лежать стиснутими в базі. Локально лишається звичайна папка,
 * а для великих обсягів можна підключити S3-сумісне сховище.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT, 'uploads');
await mkdir(UPLOAD_DIR, { recursive: true });

const BUCKET = process.env.S3_BUCKET;
const MODE = process.env.FILE_STORAGE
  || (BUCKET ? 's3' : process.env.NODE_ENV === 'production' ? 'db' : 'disk');
const MB = 1024 * 1024;
// Файл із бази сервер тримає в пам'яті цілком, а на безкоштовному плані її 512 МБ.
const DB_FILE_CAP_MB = 15;
const fileLimitMb = Number(process.env.MAX_FILE_MB) || 10;
export const MAX_FILE_MB = MODE === 'db' ? Math.min(fileLimitMb, DB_FILE_CAP_MB) : fileLimitMb;
// Файли не мають заповнити базу повністю: у ній лежать і решта даних школи.
const DB_FILES_LIMIT = (Number(process.env.DB_FILES_LIMIT_MB) || 800) * MB;
// TiDB не приймає рядок більше 6 МБ, тому файл зберігається частинами.
const CHUNK = 4 * MB;

const key = (name: string) => `submissions/${name}`;
const localPath = (name: string) => path.join(UPLOAD_DIR, path.basename(name));

type Sdk = typeof S3 & { Upload: typeof S3Upload; client: S3.S3Client };
let sdk: Sdk | null = null;
async function s3(): Promise<Sdk> {
  if (sdk) return sdk;
  const client = await import('@aws-sdk/client-s3');
  const { Upload } = await import('@aws-sdk/lib-storage');
  sdk = {
    ...client,
    Upload,
    client: new client.S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'auto',
      forcePathStyle: true,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '' },
      // Backblaze B2 і подібні сховища не приймають нові контрольні суми AWS.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  };
  return sdk;
}

/** Переносить перевірений файл із тимчасової папки в постійне сховище. */
export async function persistFile(name: string): Promise<void> {
  if (MODE === 'disk') return;
  if (MODE === 'db') {
    const { data, gzipped } = await packFile(await readFile(localPath(name)));
    const [{ used }] = await q('SELECT COALESCE(SUM(stored_size), 0) AS used FROM file_chunks');
    if (Number(used) + data.length > DB_FILES_LIMIT) {
      throw new HttpError(507, 'Місце для файлів закінчилось. Зверніться до менеджера.');
    }
    try {
      // Порожній файл теж має рядок, інакше читання вважало б його втраченим.
      for (let part = 0, at = 0; part === 0 || at < data.length; part++, at += CHUNK) {
        const chunk = data.subarray(at, at + CHUNK);
        await pool.execute('INSERT INTO file_chunks (stored_name, part, gzipped, stored_size, data) VALUES (?,?,?,?,?)', [
          name, part, gzipped ? 1 : 0, chunk.length, chunk,
        ]);
      }
    } catch (e) {
      await q('DELETE FROM file_chunks WHERE stored_name=?', [name]).catch(() => {});
      throw e;
    }
    await unlink(localPath(name)).catch(() => {});
    return;
  }
  const { Upload, client } = await s3();
  const upload = new Upload({
    client,
    params: { Bucket: BUCKET, Key: key(name), Body: createReadStream(localPath(name)), ContentType: 'application/octet-stream' },
    // Безкоштовний сервер має 512 МБ пам'яті: великий файл іде невеликими частинами.
    partSize: 8 * 1024 * 1024,
    queueSize: 2,
  });
  await upload.done();
  await unlink(localPath(name)).catch(() => {});
}

/** Повертає потік файлу. Відсутній файл дає помилку або в промісі, або подією потоку. */
export async function openFile(name: string): Promise<NodeJS.ReadableStream> {
  if (MODE === 'disk') return createReadStream(localPath(name));
  if (MODE === 'db') {
    const rows: Row[] = await q('SELECT gzipped, data FROM file_chunks WHERE stored_name=? ORDER BY part', [name]);
    if (!rows.length) throw Object.assign(new Error('Файла немає в базі'), { name: 'FileMissing' });
    return Readable.from([await unpackFile(Buffer.concat(rows.map((r) => r.data)), rows[0].gzipped)]);
  }
  const { GetObjectCommand, client } = await s3();
  const { Body } = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key(name) }));
  return Body as NodeJS.ReadableStream;
}

export async function removeFile(name: string): Promise<void> {
  await unlink(localPath(name)).catch(() => {});
  if (MODE === 'disk') return;
  if (MODE === 'db') {
    await q('DELETE FROM file_chunks WHERE stored_name=?', [name]);
    return;
  }
  const { DeleteObjectCommand, client } = await s3();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key(name) })).catch((e) => console.error(e));
}
