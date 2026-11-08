import { open } from 'node:fs/promises';

/* Перевірка вмісту завантажених файлів: за першими байтами, а не за розширенням. */

export async function readHead(filePath: string, n = 12): Promise<Buffer> {
  const fh = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(n);
    await fh.read(buf, 0, n, 0);
    return buf;
  } finally {
    await fh.close();
  }
}

export const isZip = (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b && [3, 5, 7].includes(b[2]);

export function imageMime(b: Buffer): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 3).toString('latin1') === 'GIF') return 'image/gif';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

/** Назва файлу для завантаження: ASCII-запас для старих клієнтів і точна UTF-8 назва. */
export function contentDisposition(name: string, inline: boolean): string {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
