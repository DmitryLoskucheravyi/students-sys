export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const bad = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'Не знайдено') => new HttpError(404, msg);
export const forbidden = (msg = 'Немає доступу') => new HttpError(403, msg);
export const conflict = (msg) => new HttpError(409, msg);

/* Перевірка вводу */
export function str(v, label, { max = 255, required = true } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) {
    if (required) throw bad(`Заповніть поле «${label}»`);
    return null;
  }
  if (s.length > max) throw bad(`«${label}»: максимум ${max} символів`);
  return s;
}
export function int(v, label, { min = -Infinity, max = Infinity } = {}) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (!Number.isInteger(n)) throw bad(`«${label}»: потрібне ціле число`);
  if (n < min || n > max) throw bad(`«${label}»: від ${min} до ${max}`);
  return n;
}
export function money(v, label) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 9999999) {
    throw bad(`«${label}»: некоректна сума`);
  }
  return Math.round(n * 100) / 100;
}
export function id(v, label = 'id') {
  return int(v, label, { min: 1 });
}
export function idList(v, label) {
  if (!Array.isArray(v)) throw bad(`«${label}»: потрібен список`);
  return [...new Set(v.map((x) => id(x, label)))];
}

/* Дати: рядки YYYY-MM-DD і HH:mm у локальному часі школи */
const pad = (n) => String(n).padStart(2, '0');
export function isoDate(v, label = 'Дата') {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw bad(`«${label}»: некоректна дата`);
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (y < 2000 || y > 2100 || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw bad(`«${label}»: некоректна дата`);
  return v;
}
export function hhmm(v, label = 'Час') {
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw bad(`«${label}»: некоректний час`);
  return v;
}
export function dateTime(v, label = 'Дата і час') {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(v)) {
    throw bad(`«${label}»: некоректне значення`);
  }
  isoDate(v.slice(0, 10), label);
  hhmm(v.slice(11, 16), label);
  return `${v.slice(0, 16)}:00`;
}
export function today() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}
export function nowStr() {
  const n = new Date();
  return `${today()} ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
}
export function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
/** 1 = понеділок ... 7 = неділя */
export function weekdayOf(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}
export function addMinutes(dt, minutes) {
  const [date, time] = dt.split(' ');
  const [h, mi] = time.split(':').map(Number);
  const total = h * 60 + mi + minutes;
  const dayShift = Math.floor(total / 1440);
  const rest = total - dayShift * 1440;
  return `${addDays(date, dayShift)} ${pad(Math.floor(rest / 60))}:${pad(rest % 60)}:00`;
}
export function humanDT(dt) {
  return `${dt.slice(8, 10)}.${dt.slice(5, 7)} о ${dt.slice(11, 16)}`;
}
