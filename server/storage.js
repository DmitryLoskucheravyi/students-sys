import { createReadStream } from 'node:fs';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { packFile, unpackFile } from './compress.js';
import { pool, q } from './db.js';
import { HttpError } from './lib.js';

/**
 * Файли домашніх. Диск безкоштовного хостингу стирається під час кожного рестарту,
 * тому в проді вони лежать стиснутими в базі. Локально лишається звичайна папка,
 * а для великих обсягів можна підключити S3-сумісне сховище.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
await mkdir(UPLOAD_DIR, { recursive: true });

const BUCKET = process.env.S3_BUCKET;
const MODE = process.env.FILE_STORAGE
  || (BUCKET ? 's3' : process.env.NODE_ENV === 'production' ? 'db' : 'disk');
const MB = 1024 * 1024;
// Стовпець у базі вміщує менше 16 МБ, а великий файл сервер тримав би в пам'яті.
const DB_FILE_CAP_MB = 15;
const fileLimitMb = Number(process.env.MAX_FILE_MB) || 10;
export const MAX_FILE_MB = MODE === 'db' ? Math.min(fileLimitMb, DB_FILE_CAP_MB) : fileLimitMb;
// Запас: база на 1 ГБ тримає й решту даних школи, тому файли не мають заповнити її повністю.
const DB_FILES_LIMIT = (Number(process.env.DB_FILES_LIMIT_MB) || 800) * MB;

const key = (name) => `submissions/${name}`;
const localPath = (name) => path.join(UPLOAD_DIR, path.basename(name));

let sdk = null;
async function s3() {
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
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
      // Backblaze B2 і подібні сховища не приймають нові контрольні суми AWS.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  };
  return sdk;
}

/** Переносить перевірений файл із тимчасової папки в постійне сховище. */
export async function persistFile(name) {
  if (MODE === 'disk') return;
  if (MODE === 'db') {
    const { data, gzipped } = await packFile(await readFile(localPath(name)));
    const [{ used }] = await q('SELECT COALESCE(SUM(stored_size), 0) AS used FROM file_blobs');
    if (Number(used) + data.length > DB_FILES_LIMIT) {
      throw new HttpError(507, 'Місце для файлів закінчилось. Зверніться до менеджера.');
    }
    await pool.execute('INSERT INTO file_blobs (stored_name, gzipped, stored_size, data) VALUES (?,?,?,?)', [
      name, gzipped ? 1 : 0, data.length, data,
    ]);
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
export async function openFile(name) {
  if (MODE === 'disk') return createReadStream(localPath(name));
  if (MODE === 'db') {
    const [row] = await q('SELECT gzipped, data FROM file_blobs WHERE stored_name=?', [name]);
    if (!row) throw Object.assign(new Error('Файла немає в базі'), { name: 'FileMissing' });
    return Readable.from(await unpackFile(row.data, row.gzipped));
  }
  const { GetObjectCommand, client } = await s3();
  const { Body } = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key(name) }));
  return Body;
}

export async function removeFile(name) {
  await unlink(localPath(name)).catch(() => {});
  if (MODE === 'disk') return;
  if (MODE === 'db') {
    await q('DELETE FROM file_blobs WHERE stored_name=?', [name]);
    return;
  }
  const { DeleteObjectCommand, client } = await s3();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key(name) })).catch((e) => console.error(e));
}
