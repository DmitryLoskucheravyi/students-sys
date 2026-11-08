import { gunzip, gzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/** Стискає файл, лише якщо це справді економить місце: скріни й ZIP уже стиснуті. */
export async function packFile(buffer: Buffer): Promise<{ data: Buffer; gzipped: boolean }> {
  const packed = await gzipAsync(buffer);
  return packed.length < buffer.length * 0.95 ? { data: packed, gzipped: true } : { data: buffer, gzipped: false };
}

export const unpackFile = async (data: Buffer, gzipped: boolean | number): Promise<Buffer> => (gzipped ? gunzipAsync(data) : data);
