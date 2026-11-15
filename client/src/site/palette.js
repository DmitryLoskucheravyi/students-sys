/*
 * Кольорові теми сайту: список для перемикача в кабінеті й застосування на сайті.
 * Самі кольори — у themes.css; тут назви й зразки для вибору. Сервер приймає лише ці id.
 */
export const PALETTES = [
  { id: 'green', name: 'Зелена', swatches: ['#19934b', '#0f1d16', '#ffd479', '#e9f7ef', '#ffffff'] },
  { id: 'cobalt', name: 'Кобальт', swatches: ['#3155d9', '#182d79', '#ff965e', '#ffd0a8', '#f6f5f0'] },
  { id: 'lime', name: 'Лайм', swatches: ['#202124', '#414449', '#d7f75b', '#a6b77a', '#f2f2ed'] },
  { id: 'coral', name: 'Корал', swatches: ['#18243a', '#293d59', '#ff725e', '#ffc3a8', '#f4f1ec'] },
  { id: 'violet', name: 'Фіалка', swatches: ['#17151e', '#4935a5', '#9879ff', '#ff813e', '#f5f0e9'] },
  { id: 'lavender', name: 'Лаванда', swatches: ['#a78bfa', '#c4b5fd', '#c7f464', '#191825', '#f7f5fa'] },
];
export const DEFAULT_PALETTE = 'green';
const KEY = 'bs:palette';
const known = (id) => PALETTES.some((p) => p.id === id);

/** Тема для показу: ?palette=… (перегляд без збереження) → обрана менеджером → остання показана (щоб не блимало). */
export function pickPalette(saved) {
  let fromUrl = null;
  try { fromUrl = new URLSearchParams(window.location.search).get('palette'); } catch { /* немає адреси */ }
  if (known(fromUrl)) return fromUrl;
  if (known(saved)) return saved;
  try { const cached = localStorage.getItem(KEY); if (known(cached)) return cached; } catch { /* сховище недоступне */ }
  return DEFAULT_PALETTE;
}

/** Ставить тему на <html> і фарбує рядок браузера (Safari на iPhone бере його колір для тла навколо сторінки). */
export function applyPalette(id, { remember = true } = {}) {
  const root = document.documentElement;
  if (id === DEFAULT_PALETTE) delete root.dataset.palette; else root.dataset.palette = id;
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim() || '#ffffff';
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', paper);
  if (remember) { try { localStorage.setItem(KEY, id); } catch { /* сховище недоступне */ } }
}
