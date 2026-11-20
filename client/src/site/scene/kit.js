/*
 * Спільне для 3D-сцен карток: текстури, намальовані на 2D-полотні (на проді CSP пускає лише 'self',
 * тож жодних шрифтів чи HDR з CDN), кольори з токенів картки і дрібні помічники руху.
 */
import * as THREE from 'three';

const cache = new Map();

/** Текстура з 2D-полотна; draw(ctx, w, h). Кешується за ключем. */
export function canvasTexture(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Мʼяка кругла тінь під предметом (замість карт тіней). */
export const blobShadow = () => canvasTexture('shadow', 128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(20,16,40,0.55)');
  g.addColorStop(0.55, 'rgba(20,16,40,0.18)');
  g.addColorStop(1, 'rgba(20,16,40,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
});

/** Підпис на прозорому тлі або в пігулці: «+1», «200 OK», літера на клавіші. */
export function textTexture(text, { size = 96, color = '#fff', bg = null, pad = 28, weight = 800, font = "'Onest Variable', 'Onest', system-ui, sans-serif" } = {}) {
  const key = `t:${text}:${size}:${color}:${bg}:${weight}`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `${weight} ${size}px ${font}`;
  const tw = Math.ceil(probe.measureText(text).width);
  const w = tw + pad * 2; const h = Math.ceil(size * 1.5);
  const tex = canvasTexture(key, w, h, (ctx) => {
    if (bg) { ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(0, 0, w, h, h / 2); ctx.fill(); }
    ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + size * 0.04);
  });
  tex.userData.aspect = w / h;
  return tex;
}

/** Колір токена, світліший (amt > 0) чи темніший (amt < 0) — нових кольорів не вводимо. */
export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  return `#${c.lerp(new THREE.Color(amt > 0 ? '#ffffff' : '#000000'), Math.abs(amt)).getHexString()}`;
}

export const MASCOT = { cover: '#F47A2E', spine: '#D65F1D', pages: '#F8F1E4' };

/** Пружина без бібліотеки: v += (target - x) * k; v *= damping. Повертає нове [x, v]. */
export function spring(x, v, target, dt, k = 180, damping = 14) {
  const a = (target - x) * k - v * damping;
  const nv = v + a * dt;
  return [x + nv * dt, nv];
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const easeOut = (x) => 1 - (1 - clamp01(x)) ** 3;
/** 0 → 1 → 0 за час d, починаючи з t0 */
export const bump = (t, t0, d) => { const k = (t - t0) / d; return k < 0 || k > 1 ? 0 : Math.sin(Math.PI * k); };
