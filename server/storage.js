import { createReadStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Файли домашніх. Локально вони лежать на диску, а в проді їдуть у S3-сумісне сховище,
 * бо диск безкоштовного хостингу стирається під час кожного рестарту.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
await mkdir(UPLOAD_DIR, { recursive: true });

const BUCKET = process.env.S3_BUCKET;
export const usesObjectStorage = Boolean(BUCKET);
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
  if (!usesObjectStorage) return;
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
  if (!usesObjectStorage) return createReadStream(localPath(name));
  const { GetObjectCommand, client } = await s3();
  const { Body } = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key(name) }));
  return Body;
}

export async function removeFile(name) {
  await unlink(localPath(name)).catch(() => {});
  if (!usesObjectStorage) return;
  const { DeleteObjectCommand, client } = await s3();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key(name) })).catch((e) => console.error(e));
}
