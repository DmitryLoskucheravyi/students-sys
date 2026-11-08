import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Корінь репозиторію. Сервер запускається зібраним із dist/server, а юніт-тести беруть
 * вихідні .ts напряму з server, тож глибина різна.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, here.split(path.sep).includes('dist') ? '../..' : '..');
