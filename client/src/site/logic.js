/*
 * Чисті функції сайту: без React і DOM, лише вхід → вихід. Покриті тестами в tests/unit/siteLogic.test.js.
 */
import { plural } from '../fmt.js';

/* ───────── Слова ───────── */

export const topicsWord = (n) => `${n} ${plural(n, 'тема', 'теми', 'тем')}`;
export const coursesWord = (n) => `${n} ${plural(n, 'курс', 'курси', 'курсів')}`;
export const subtopicsWord = (n) => `${n} ${plural(n, 'підтема', 'підтеми', 'підтем')}`;

/** Ініціали для аватарки відгуку: перші літери перших двох слів. Зайві пробіли не заважають. */
export function initials(name) {
  return String(name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/** Клас кольору квитка абонемента; невідомий колір — фірмовий червоний. */
const TICKET_COLORS = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink', 'ink'];
export const ticketClass = (color) => `tk-${TICKET_COLORS.includes(color) ? color : 'red'}`;

/** Підпис під назвою напрямку: скільки курсів (якщо їх кілька) і скільки тем загалом. */
export function directionMeta(d) {
  return [d.courses.length > 1 && coursesWord(d.courses.length), d.steps > 0 && topicsWord(d.steps)].filter(Boolean).join(', ');
}

/* ───────── Ціни на головній ───────── */

/**
 * Які абонементи показати. Їх завжди 5:
 * телефон — 1-й, 3-й і 5-й по одному; компʼютер — три в ряд, 3-й посередині, по боках 1-й і 5-й або (alt) 2-й і 4-й.
 * Якщо раптом менше п'яти — просто перші три.
 */
export function homePlans(plans, { wide, alt }) {
  if (plans.length < 5) return plans.slice(0, 3);
  if (!wide) return [plans[0], plans[2], plans[4]];
  return alt ? [plans[1], plans[2], plans[3]] : [plans[0], plans[2], plans[4]];
}

/* ───────── Стопка карток ───────── */

/** Місце картки k у стопці, коли попереду картка front: 0 — передня, далі глибше. */
export const stackPos = (k, front, total) => (k - front + total) % total;

/* ───────── Роадмап у хіро ───────── */

/**
 * Прогрес роадмапу на компʼютері: хіро прилипає, а прокрутка всередині нього (room) відкриває картки.
 * heroTop — верх хіро відносно вікна, head — висота шапки, heroHeight — висота хіро разом із запасом прокрутки.
 */
export function desktopProgress({ heroTop, heroHeight, vh, head }) {
  const room = Math.max(1, heroHeight - (vh - head));
  return ((head - heroTop) / room) * 1.12;
}

/**
 * Прогрес роадмапу на телефоні: 0 при заході, 1 — коли низ роадмапу доїхав до середини екрана.
 * roadmapBottom — низ роадмапу відносно вікна.
 */
export function mobileProgress({ roadmapBottom, scrollY, vh }) {
  const room = roadmapBottom + scrollY - vh * 0.5;
  return room <= 0 ? 1 : scrollY / room;
}

/**
 * Скільки карток роадмапу відкрито (з total) при прогресі p.
 * Компʼютер: навіть «Старт» чекає першої прокрутки. Телефон: «Старт» видно одразу.
 */
export function shownCount(p, total, { wide }) {
  if (wide) {
    let n = 0;
    for (let i = 0; i < total; i += 1) if (p >= (i + 1) / (total + 1)) n = i + 1;
    return n;
  }
  let n = 1;
  for (let i = 1; i < total; i += 1) if (p >= (i / (total - 1)) * 0.96) n = i + 1;
  return n;
}

/* ───────── Шторка «пробне заняття» ───────── */

/**
 * Чи можна висувати шторку: кнопка повністю в кадрі й стоїть на своєму місці.
 * На телефоні кнопка спершу прилипла до низу екрана — на місці вона, коли низ хіро вже в кадрі.
 */
export function peekReady({ wide, panelBottom, buttonTop, buttonBottom, vh }) {
  const settled = wide || panelBottom <= vh + 2;
  return settled && buttonTop >= 0 && buttonBottom <= vh;
}
