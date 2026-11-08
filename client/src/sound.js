/*
 * Легкі звуки тесту, синтезовані WebAudio: без файлів і без мережі.
 * Вимикаються кнопкою; вибір пам'ятає браузер. Контекст створюється після першого дотику (вимога браузерів).
 */
const KEY = 'bs-sound';
let ctx = null;

export function soundOn() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setSound(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* без сховища звук просто не запам'ятається */ }
}

function audio() {
  if (!soundOn()) return null;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Один тон із м'якою атакою й згасанням. */
function tone(freq, { at = 0, dur = 0.12, type = 'sine', gain = 0.08, slide = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  /** Вибір варіанта: короткий «тик». */
  pick: () => tone(880, { dur: 0.07, type: 'triangle', gain: 0.06 }),
  /** Зняти вибір. */
  unpick: () => tone(520, { dur: 0.06, type: 'triangle', gain: 0.045 }),
  /** Далі: легкий підйом. */
  next: () => tone(520, { dur: 0.13, gain: 0.05, slide: 1.5 }),
  /** Назад: легкий спуск. */
  back: () => tone(620, { dur: 0.13, gain: 0.05, slide: 0.66 }),
  /** Пропустити: глухий короткий тон. */
  skip: () => tone(300, { dur: 0.1, type: 'triangle', gain: 0.05 }),
  /** Гарний результат: висхідне арпеджіо. */
  win: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.32, type: 'triangle', gain: 0.07 })),
  /** Слабкий результат: спокійні два тони, без «провалу». */
  soft: () => [440, 392].forEach((f, i) => tone(f, { at: i * 0.14, dur: 0.3, gain: 0.06 })),
};
