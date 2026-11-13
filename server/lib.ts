/** Помилка з текстом для людини: її повідомлення бачить користувач. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const bad = (msg: string) => new HttpError(400, msg);
export const notFound = (msg = 'Не знайдено') => new HttpError(404, msg);
export const forbidden = (msg = 'Немає доступу') => new HttpError(403, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

/* Перевірка вводу */
export function str(v: unknown, label: string, opts?: { max?: number; required?: true }): string;
export function str(v: unknown, label: string, opts: { max?: number; required: false }): string | null;
export function str(v: unknown, label: string, { max = 255, required = true }: { max?: number; required?: boolean } = {}): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) {
    if (required) throw bad(`Заповніть поле «${label}»`);
    return null;
  }
  if (s.length > max) throw bad(`«${label}»: максимум ${max} символів`);
  return s;
}
export function int(v: unknown, label: string, { min = -Infinity, max = Infinity }: { min?: number; max?: number } = {}): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (!Number.isInteger(n)) throw bad(`«${label}»: потрібне ціле число`);
  const value = n as number;
  if (value < min || value > max) throw bad(`«${label}»: від ${min} до ${max}`);
  return value;
}
export function money(v: unknown, label: string): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 9999999) {
    throw bad(`«${label}»: некоректна сума`);
  }
  return Math.round(n * 100) / 100;
}
export function id(v: unknown, label = 'id'): number {
  return int(v, label, { min: 1 });
}
export function idList(v: unknown, label: string): number[] {
  if (!Array.isArray(v)) throw bad(`«${label}»: потрібен список`);
  return [...new Set(v.map((x) => id(x, label)))];
}

/* Дати: рядки YYYY-MM-DD і HH:mm у локальному часі школи */
const pad = (n: number) => String(n).padStart(2, '0');
export function isoDate(v: unknown, label = 'Дата'): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw bad(`«${label}»: некоректна дата`);
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (y < 2000 || y > 2100 || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw bad(`«${label}»: некоректна дата`);
  return v;
}
export function hhmm(v: unknown, label = 'Час'): string {
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw bad(`«${label}»: некоректний час`);
  return v;
}
export function dateTime(v: unknown, label = 'Дата і час'): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(v)) {
    throw bad(`«${label}»: некоректне значення`);
  }
  isoDate(v.slice(0, 10), label);
  hhmm(v.slice(11, 16), label);
  return `${v.slice(0, 16)}:00`;
}
export function today(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}
export function nowStr(): string {
  const n = new Date();
  return `${today()} ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
}
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
/** 1 = понеділок ... 7 = неділя */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}
export function addMinutes(dt: string, minutes: number): string {
  const [date, time] = dt.split(' ');
  const [h, mi] = time.split(':').map(Number);
  const total = h * 60 + mi + minutes;
  const dayShift = Math.floor(total / 1440);
  const rest = total - dayShift * 1440;
  return `${addDays(date, dayShift)} ${pad(Math.floor(rest / 60))}:${pad(rest % 60)}:00`;
}
export function humanDT(dt: string): string {
  return `${dt.slice(8, 10)}.${dt.slice(5, 7)} о ${dt.slice(11, 16)}`;
}

/**
 * Телефон із форми: лише цифри, пробіли, дужки, дефіси, крапки й «+»; від 9 до 15 цифр.
 * Український номер без коду країни (0XXXXXXXXX) стає +380XXXXXXXXX.
 */
export function normalizePhone(v: unknown): string {
  const raw = typeof v === 'string' ? v.trim() : '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15 || /[^\d\s()+\-.]/.test(raw)) throw bad('Перевірте номер телефону');
  if (digits.length === 10 && digits.startsWith('0')) return `+38${digits}`;
  return `+${digits}`;
}
