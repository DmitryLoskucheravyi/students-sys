/*
 * Телефон у формах: «+38 » стоїть одразу й не стирається, номер форматується як «+38 067 123 45 67».
 * «67…» без нуля стає «067…». Іноземний номер — з «+» і іншим кодом країни (наприклад, «+48 …»): лишається як є.
 * На сервер ідемо у вигляді «+380671234567»; лише префікс — це «номера немає» ('').
 */

export const UA_PREFIX = '+38 ';

export function formatPhone(input) {
  const raw = String(input ?? '').trim();
  let d = raw.replace(/\D/g, '');
  // Іноземний: «+» і код країни не 38. Проміжні «+» і «+3» лишаємо — інакше «+48» не набрати (поле переформатовується щоразу).
  if (raw.startsWith('+') && !d.startsWith('38') && !d.startsWith('0')) {
    if (d === '' || d === '3') return `+${d}`;
    return `+${d.slice(0, 15)}`;
  }
  if (d.startsWith('38')) d = d.slice(2);
  if (d && d[0] !== '0') d = `0${d}`;
  d = d.slice(0, 10);
  return UA_PREFIX + [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ');
}

/**
 * Нове значення поля з урахуванням того, що саме вставили (prev → next):
 * — вставили повний номер (≥ 9 цифр, наприклад зі списку контактів) — беремо його замість префікса, а не дописуємо до «+38 »;
 * — вставили всередину «+38 » (курсор там опинився) — переносимо вставлене в кінець.
 */
export function nextPhone(prev, next) {
  let i = 0;
  while (i < prev.length && i < next.length && prev[i] === next[i]) i++;
  let j = 0;
  while (j < prev.length - i && j < next.length - i && prev[prev.length - 1 - j] === next[next.length - 1 - j]) j++;
  const inserted = next.slice(i, next.length - j);
  if (inserted.replace(/\D/g, '').length >= 9) return formatPhone(inserted);
  // лише чиста вставка (нічого не стерто: i + j = вся довжина prev); якщо замінили весь вміст — це новий номер
  if (inserted && i + j === prev.length && prev.startsWith(UA_PREFIX) && i < UA_PREFIX.length) return formatPhone(prev + inserted);
  return formatPhone(next);
}

/** Для збереження: «+380671234567», іноземний — «+48…», нічого не введено — ''. */
export function phoneForSave(v) {
  const f = formatPhone(v);
  const d = f.replace(/\D/g, '');
  if (f.startsWith(UA_PREFIX)) return d.length > 2 ? `+${d}` : '';
  return d ? `+${d}` : '';
}

/** Чи номер повний: український — 0 і ще 9 цифр, іноземний — 9–15 цифр. Порожній — валідний (обовʼязковість окремо). */
export function phoneProblem(v, required = false) {
  const save = phoneForSave(v);
  if (!save) return required ? 'Вкажіть номер телефону' : '';
  const d = save.replace(/\D/g, '');
  if (formatPhone(v).startsWith(UA_PREFIX)) return d.length === 12 ? '' : 'Номер має бути з 10 цифр: 0XX XXX XX XX';
  return d.length >= 9 && d.length <= 15 ? '' : 'Перевірте номер телефону';
}
