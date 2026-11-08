/*
 * Червона «гумова» заливка на сторінці входу: фон лівої панелі перетікає в праву половину
 * й огинає форму. Зверху й знизу заходить виступами, біля форми лишається тонкою смугою.
 * Набігає з пружним перехлестом, далі край ледь хвилюється.
 * Форма малюється через clip-path: path(), тож усередині та сама сітка, що й на панелі.
 */

const exp = Math.exp;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const GROW_DELAY = 0.25;   // с від появи сторінки
const GROW_TIME = 1.15;    // с на основне заливання
const SAMPLES = 26;        // точок на кожну криву краю

function bezier(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** Цільовий край: точки згори донизу. Розміри беруться від форми, щоб смуга біля неї не налазила на поля. */
function targetEdge(w, h, form) {
  const fl = form ? form.left : w * 0.06;
  const ft = form ? form.top : h * 0.33;
  const fb = form ? form.bottom : h * 0.71;
  const neck = clamp(fl * 0.12, 4, 50);
  const y1 = Math.max(h * 0.1, ft - 60);
  const y2 = Math.min(h * 0.92, fb + 35);
  const yEnd = h * 0.993;
  const top = bezier([w * 0.5, 0], [w * 0.3, y1 * 0.1], [neck + w * 0.03, y1 * 0.4], [neck, y1], SAMPLES);
  const mid = bezier([neck, y1], [neck * 0.8, y1 + (y2 - y1) * 0.3], [neck * 0.8, y1 + (y2 - y1) * 0.7], [neck, y2], 10);
  const bottom = bezier([neck, y2], [neck + w * 0.05, y2 + (yEnd - y2) * 0.7], [w * 0.38, y2 + (yEnd - y2) * 0.97], [w, yEnd], SAMPLES);
  return [...top, ...mid.slice(1), ...bottom.slice(1)];
}

/** Пружне заливання з перехлестом, як гума, що набігає й осідає. */
const spring = (p) => (p <= 0 ? 0 : 1 - exp(-5 * p) * Math.cos(6.5 * p));

/**
 * el — блок із червоним фоном у правій колонці, formEl — форма входу.
 * still: без руху, одразу кінцева форма. Повертає функцію зупинки.
 */
export function mountLiquid(el, formEl, { still = false } = {}) {
  let edge = null;
  let size = { w: 0, h: 0 };
  const measure = () => {
    const w = el.clientWidth; const h = el.clientHeight;
    size = { w, h };
    if (!w || !h) { edge = null; return; }
    const box = el.getBoundingClientRect();
    const f = formEl?.getBoundingClientRect();
    // Береться вміст форми без внутрішніх відступів: смуга огинає саме поля й текст
    const pad = 20;
    const form = f && f.width ? { left: f.left - box.left + pad, top: f.top - box.top + pad, bottom: f.bottom - box.top - pad } : null;
    edge = targetEdge(w, h, form);
  };

  const draw = (t) => {
    if (!edge) { el.style.clipPath = 'inset(0 100% 0 0)'; return; }
    const { w, h } = size;
    const amp = still ? 0 : 2.5 + 9 * exp(-Math.max(0, t - GROW_DELAY - GROW_TIME) / 1.3);
    const cur = edge.map(([x, y]) => {
      const share = x / w;
      // Широкі виступи рушають трохи раніше: край згинається, а не їде рівною лінією
      const grow = still ? 1 : spring((t - GROW_DELAY - 0.28 * (1 - clamp(share / 0.5, 0, 1))) / GROW_TIME);
      // Хвиля сильніша на виступах і майже нульова біля форми
      const wave = amp * Math.sin(y * 0.017 - t * 2.1 + share * 3) * clamp(share / 0.15, 0.15, 1);
      return [Math.max(0, x * grow + wave * Math.min(1, grow)), y];
    });
    let d = `M0,0 L${cur[0][0].toFixed(1)},0`;
    for (const [x, y] of cur) d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
    d += ` L${w},${h} L0,${h} Z`;
    el.style.clipPath = `path('${d}')`;
  };

  measure();
  const ro = new ResizeObserver(() => { measure(); if (still) draw(10); });
  ro.observe(el);
  if (formEl) ro.observe(formEl);

  if (still) {
    draw(10);
    return () => ro.disconnect();
  }

  const start = performance.now();
  let raf = 0;
  const tick = (now) => {
    const t = (now - start) / 1000;
    draw(t);
    el.dataset.grown = t > GROW_DELAY + GROW_TIME ? '1' : '0';
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}
