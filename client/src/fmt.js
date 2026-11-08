const pad = (n) => String(n).padStart(2, '0');

export const parseDate = (d) => {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day);
};
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const addDays = (iso, n) => {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const weekdayOf = (iso) => parseDate(iso).getDay() || 7;
export const mondayOf = (iso) => addDays(iso, 1 - weekdayOf(iso));
export const nowLocal = () => {
  const n = new Date();
  return `${toISO(n)} ${pad(n.getHours())}:${pad(n.getMinutes())}:00`;
};

/** Здано пізніше за дедлайн. Обидва значення — рядки «YYYY-MM-DD HH:MM:SS». */
export const isLate = (doneAt, dueAt) => Boolean(doneAt && dueAt && doneAt > dueAt);

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
export const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

export const dayMonth = (iso) => {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
};
export const shortDate = (iso) => {
  if (!iso) return '';
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
};
export const time = (dt) => dt.slice(11, 16);
export const weekdayDayMonth = (iso) => `${WEEKDAYS[weekdayOf(iso) - 1]}, ${dayMonth(iso)}`;
export const dateTimeShort = (dt) => `${dayMonth(dt.slice(0, 10))}, ${time(dt)}`;

export const weekTitle = (monday) => {
  const end = addDays(monday, 6);
  const a = parseDate(monday);
  const b = parseDate(end);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MONTHS_GEN[a.getMonth()]}`
    : `${dayMonth(monday)} – ${dayMonth(end)}`;
};

export const money = (n) => `${Number(n ?? 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}
export const lessonsWord = (n) => `${n} ${plural(n, 'урок', 'уроки', 'уроків')}`;
export const studentsWord = (n) => `${n} ${plural(n, 'учень', 'учні', 'учнів')}`;

export const fileSize = (b) => {
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} КБ`;
  return `${(b / 1024 / 1024).toFixed(1)} МБ`;
};

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function randomPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
