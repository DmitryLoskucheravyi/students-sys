/*
 * Тривимірні острівці тестування на роадмапі (three.js, вантажиться лише на сторінці курсу).
 * Острівець пливе над кам'яною підставкою з викарбуваним номером етапу. На ньому одна з «програмістських» сцен:
 * термінал, серверна, ракета-деплой, знак </> або git-дерево. Навколо здіймаються біти коду.
 *
 * Острівців на сторінці може бути багато, а WebGL-контекстів браузер дає обмаль. Тому рендерер один:
 * він малює кожну сцену й копіює кадр у звичайне 2D-полотно острівця. Невидимі острівці не малюються.
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const STONE = '#d9d2cc';
const ROCK = '#6b5b55';

let renderer = null;
const live = new Set();
let raf = 0;

function sharedRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  return renderer;
}

function loop(now) {
  raf = 0;
  const t = now / 1000;
  for (const isl of live) if (isl.visible) isl.draw(t);
  if ([...live].some((i) => i.visible && !i.still)) raf = requestAnimationFrame(loop);
}
const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

/* ---------- матеріали й дрібниці ---------- */
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, flatShading: true, ...extra });
const glow = (color, k = 1.4) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4 });

/** Трохи «зім'яти» вершини: низькополігональне каміння. */
function jitter(geo, amount, seed = 1) {
  const pos = geo.attributes.position;
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)}|${pos.getY(i).toFixed(3)}|${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(k)) seen.set(k, [rnd() * amount, rnd() * amount, rnd() * amount]);
    const [dx, dy, dz] = seen.get(k);
    pos.setXYZ(i, pos.getX(i) + dx, pos.getY(i) + dy * 0.6, pos.getZ(i) + dz);
  }
  geo.computeVertexNormals();
  return geo;
}

function textTexture(draw, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, ctx, canvas: c };
}

const FONT = getComputedStyle(document.documentElement).getPropertyValue('--display').trim() || 'Arial Black, sans-serif';

/** Номер, викарбуваний у камені: темна тінь угорі, світлий відблиск унизу. */
function engraved(number) {
  return textTexture((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e4ddd6'); g.addColorStop(1, '#c9c0b8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Зерно каменю
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(80,60,50,${Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.font = `800 ${h * 0.62}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const x = w / 2, y = h / 2 + h * 0.04;
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(number, x, y + 3);
    ctx.fillStyle = 'rgba(40,25,20,0.7)'; ctx.fillText(number, x, y - 3);
    ctx.fillStyle = '#9d928a'; ctx.fillText(number, x, y);
  }, 256, 200).tex;
}

const GLYPHS = ['0', '1', '{ }', ';', '</>', '=>', '()', '#'];
const glyphTex = new Map();
function glyph(text, color) {
  const k = `${text}|${color}`;
  if (!glyphTex.has(k)) {
    glyphTex.set(k, textTexture((ctx, w, h) => {
      ctx.font = `700 ${text.length > 2 ? 46 : 70}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = color; ctx.shadowBlur = 14;
      ctx.fillStyle = color; ctx.fillText(text, w / 2, h / 2);
    }, 128, 128).tex);
  }
  return glyphTex.get(k);
}

/* ---------- сцени на острівці ---------- */
const CODE = [
  ['const ', 'quiz', ' = await ', 'load', '();'],
  ['for ', '(const q of quiz) {'],
  ['  if ', '(q.ok) score++;'],
  ['}'],
  ['return ', 'score', ' >= ', 'pass', ';'],
  ['// ', 'ти впораєшся'],
];

function terminal(accent) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.88, 0.14), mat('#2a2630'));
  body.position.set(0, 0.78, 0);
  const screenTex = textTexture(() => {}, 320, 220);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.76), new THREE.MeshBasicMaterial({ map: screenTex.tex }));
  screen.position.set(0, 0.78, 0.075);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.1), mat('#3a3540'));
  stand.position.set(0, 0.25, -0.02);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.3), mat('#3a3540'));
  foot.position.set(0, 0.1, 0);
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.3), mat('#ece6e0'));
  kb.position.set(0.05, 0.1, 0.55); kb.rotation.y = -0.12;
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.18, 10), mat(accent));
  mug.position.set(-0.72, 0.18, 0.35);
  g.add(body, screen, stand, foot, kb, mug);
  g.rotation.y = 0.18;

  let last = -1;
  const draw = (t) => {
    const step = Math.floor(t * 9);
    if (step === last) return;
    last = step;
    const { ctx, canvas } = screenTex;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#14121a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 0, W, 22);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(14 + i * 16, 11, 5, 0, TAU); ctx.fill(); });
    ctx.font = '600 17px ui-monospace, Consolas, monospace';
    const total = CODE.reduce((n, l) => n + l.join('').length, 0);
    let budget = step % (total + 40);
    const colors = ['#c792ea', accent, '#89ddff', '#82aaff', '#f78c6c'];
    let y = 46;
    for (const line of CODE) {
      let x = 12;
      for (const [k, part] of line.entries()) {
        if (budget <= 0) break;
        const shown = part.slice(0, budget);
        budget -= part.length;
        ctx.fillStyle = line[0] === '// ' ? '#6c6f85' : colors[k % colors.length];
        ctx.fillText(shown, x, y);
        x += ctx.measureText(shown).width;
      }
      if (budget <= 0) {
        if (step % 2) { ctx.fillStyle = accent; ctx.fillRect(x + 2, y - 15, 9, 18); }
        break;
      }
      y += 28;
    }
    screenTex.tex.needsUpdate = true;
  };
  return { group: g, update: draw };
}

function server(accent) {
  const g = new THREE.Group();
  const leds = [];
  [-0.48, 0, 0.48].forEach((x, i) => {
    const h = i === 1 ? 1.25 : 1.0;
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, 0.45), mat('#2b2832'));
    rack.position.set(x, 0.1 + h / 2, i === 1 ? -0.1 : 0);
    g.add(rack);
    for (let r = 0; r < Math.floor(h / 0.16); r++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.01), mat('#45404e'));
      slot.position.set(x, 0.2 + r * 0.16, rack.position.z + 0.231);
      g.add(slot);
      for (let k = 0; k < 2; k++) {
        const color = k ? accent : '#38e07b';
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), glow(color));
        led.position.set(x + 0.1 + k * 0.06, 0.25 + r * 0.16, rack.position.z + 0.235);
        led.userData.phase = Math.random() * 10;
        led.userData.speed = 2 + Math.random() * 6;
        leds.push(led); g.add(led);
      }
    }
  });
  // Кабель між стійками
  const cable = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 24, Math.PI), mat(accent));
  cable.position.set(-0.24, 0.12, 0.38); cable.rotation.x = Math.PI;
  const cable2 = cable.clone(); cable2.position.x = 0.24;
  g.add(cable, cable2);
  return {
    group: g,
    update: (t) => { for (const l of leds) l.material.emissiveIntensity = Math.sin(t * l.userData.speed + l.userData.phase) > 0.2 ? 1.6 : 0.05; },
  };
}

function rocket(accent) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.12, 12), mat('#4a4450'));
  pad.position.y = 0.16;
  const stripes = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.02, 4, 24), glow('#ffd23f', 0.8));
  stripes.rotation.x = Math.PI / 2; stripes.position.y = 0.23;
  g.add(pad, stripes);
  const ship = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.85, 14), mat('#f4f1ee', { flatShading: false }));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 14), mat(accent, { flatShading: false }));
  nose.position.y = 0.63;
  const win = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14), glow('#7fd3ff', 0.9));
  win.rotation.x = Math.PI / 2; win.position.set(0, 0.18, 0.21);
  ship.add(body, nose, win);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.24), mat(accent));
    const a = (i / 3) * TAU;
    fin.position.set(Math.sin(a) * 0.24, -0.32, Math.cos(a) * 0.24);
    fin.rotation.y = a;
    ship.add(fin);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 10), new THREE.MeshBasicMaterial({ color: '#ffb43a', transparent: true, opacity: 0.9 }));
  flame.rotation.x = Math.PI; flame.position.y = -0.68;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 8), new THREE.MeshBasicMaterial({ color: '#fff3c4' }));
  core.rotation.x = Math.PI; core.position.y = -0.58;
  ship.add(flame, core);
  g.add(ship);
  const puffs = Array.from({ length: 7 }, (_, i) => {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), new THREE.MeshStandardMaterial({ color: '#eeeeee', transparent: true, opacity: 0.6, flatShading: true }));
    p.userData.off = i / 7;
    g.add(p);
    return p;
  });
  return {
    group: g,
    update: (t) => {
      ship.position.y = 1.0 + Math.sin(t * 1.6) * 0.14;
      ship.rotation.y = t * 0.6;
      const f = 0.85 + Math.sin(t * 40) * 0.12 + Math.sin(t * 23) * 0.08;
      flame.scale.set(f, 1 + (f - 0.85) * 2, f);
      for (const p of puffs) {
        const k = (t * 0.5 + p.userData.off) % 1;
        const a = p.userData.off * TAU;
        p.position.set(Math.sin(a) * (0.2 + k * 0.6), 0.25 + k * 0.25, Math.cos(a) * (0.2 + k * 0.6));
        p.scale.setScalar(0.6 + k * 1.6);
        p.material.opacity = 0.55 * (1 - k);
      }
    },
  };
}

function code(accent) {
  const g = new THREE.Group();
  const sign = new THREE.Group();
  const m = mat(accent, { emissive: accent, emissiveIntensity: 0.35, flatShading: false });
  const bar = (x, y, rot, len = 0.5) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, len, 0.16), m);
    b.position.set(x, y, 0); b.rotation.z = rot; sign.add(b);
  };
  bar(-0.55, 0.14, -0.75); bar(-0.55, -0.14, 0.75);   // <
  bar(0.55, 0.14, 0.75); bar(0.55, -0.14, -0.75);     // >
  bar(0, 0, -0.38, 0.95);                              // /
  sign.position.y = 1.0;
  g.add(sign);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.2, 8), mat('#3a3540'));
  base.position.y = 0.2;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.22, 0.5, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
  beam.position.y = 0.52;
  g.add(base, beam);
  const bits = Array.from({ length: 8 }, (_, i) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), glow(i % 2 ? accent : '#7fd3ff', 0.9));
    c.userData.a = (i / 8) * TAU; c.userData.r = 0.85 + (i % 3) * 0.12;
    g.add(c);
    return c;
  });
  return {
    group: g,
    update: (t) => {
      sign.rotation.y = Math.sin(t * 0.9) * 0.6;
      sign.position.y = 1.0 + Math.sin(t * 1.7) * 0.07;
      beam.material.opacity = 0.18 + Math.sin(t * 3) * 0.08;
      for (const b of bits) {
        const a = b.userData.a + t * 0.9;
        b.position.set(Math.cos(a) * b.userData.r, 1.0 + Math.sin(a * 2) * 0.25, Math.sin(a) * b.userData.r * 0.6);
        b.rotation.set(t * 2, t * 3, 0);
      }
    },
  };
}

function git(accent) {
  const g = new THREE.Group();
  const line = (a, b, color) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, dir.length(), 6), mat(color));
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    g.add(m);
  };
  const V = (x, y) => new THREE.Vector3(x, y, 0);
  const main = [V(0, 0.15), V(0, 0.55), V(0, 0.95), V(0, 1.35), V(0, 1.7)];
  const feat = [V(0, 0.55), V(0.45, 0.85), V(0.45, 1.15), V(0, 1.35)];
  const fix = [V(0, 0.95), V(-0.45, 1.2), V(-0.45, 1.5)];
  for (let i = 1; i < main.length; i++) line(main[i - 1], main[i], '#4a4450');
  for (let i = 1; i < feat.length; i++) line(feat[i - 1], feat[i], accent);
  for (let i = 1; i < fix.length; i++) line(fix[i - 1], fix[i], '#38b26d');
  const commits = [];
  const node = (p, color) => {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), glow(color, 0.3));
    n.position.copy(p); g.add(n); commits.push(n);
  };
  main.slice(1).forEach((p) => node(p, '#ece6e0'));
  feat.slice(1, 3).forEach((p) => node(p, accent));
  fix.slice(1).forEach((p) => node(p, '#38b26d'));
  g.rotation.y = 0.25;
  return {
    group: g,
    update: (t) => {
      const k = Math.floor(t * 3) % commits.length;
      commits.forEach((c, i) => {
        c.material.emissiveIntensity = i === k ? 1.8 : 0.25;
        c.scale.setScalar(i === k ? 1.35 : 1);
      });
    },
  };
}

const DESIGNS = { terminal, server, rocket, code, git };

/* ---------- острівець ---------- */
function buildIsland(accent, number) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff6ef', '#5a4a50', 1.25));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6);
  sun.position.set(3, 5, 4);
  scene.add(sun);

  const floating = new THREE.Group();
  const top = new THREE.Mesh(jitter(new THREE.CylinderGeometry(1.32, 1.22, 0.24, 11, 1), 0.06, 7), mat(accent));
  const soil = new THREE.Mesh(jitter(new THREE.CylinderGeometry(1.22, 1.12, 0.22, 11, 1), 0.08, 3), mat('#8a6f5f'));
  soil.position.y = -0.22;
  const rock = new THREE.Mesh(jitter(new THREE.ConeGeometry(1.12, 1.35, 11, 3), 0.16, 11), mat(ROCK));
  rock.rotation.x = Math.PI; rock.position.y = -0.98;
  floating.add(top, soil, rock);
  // Кілька каменців і кущиків, щоб острів не був голим
  [[0.95, 0.35, 0.12], [-0.9, -0.5, 0.09], [0.7, -0.75, 0.1]].forEach(([x, z, r], i) => {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat(i === 1 ? STONE : '#2f8f57'));
    s.position.set(x, 0.14, z); floating.add(s);
  });

  const pedestal = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.14, 6), mat('#cfc6be'));
  slab.rotation.y = -Math.PI / 6; slab.position.y = 0.55;
  const prism = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.0, 6), mat(STONE));
  prism.rotation.y = -Math.PI / 6;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.12, 0.18, 6), mat('#bfb5ad'));
  foot.rotation.y = -Math.PI / 6; foot.position.y = -0.58;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.66), new THREE.MeshStandardMaterial({ map: engraved(number), roughness: 0.9 }));
  plate.position.set(0, 0.0, 0.737);
  pedestal.add(slab, prism, foot, plate);
  pedestal.position.y = -2.6;
  pedestal.rotation.y = 0.0;

  // Світний промінь між підставкою й островом
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 0.55, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = -1.85;

  scene.add(floating, pedestal, beam);

  const bits = Array.from({ length: 9 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyph(GLYPHS[i % GLYPHS.length], i % 3 ? accent : '#7fd3ff'), transparent: true, depthWrite: false }));
    s.userData.off = i / 9;
    s.userData.a = i * 2.4;
    scene.add(s);
    return s;
  });

  return { scene, floating, beam, bits };
}

/**
 * Монтує острівець у el. design — один із ISLAND_DESIGNS, number — текст на підставці.
 * still: лише один кадр (тести, зменшений рух). Повертає функцію демонтажу.
 */
export function mountIsland(el, { design = 'terminal', number = '1', still = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'island-canvas';
  el.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const accent = getComputedStyle(el).getPropertyValue('--red-fill').trim() || '#d6112b';

  const { scene, floating, beam, bits } = buildIsland(accent, number);
  const scenery = (DESIGNS[design] ?? terminal)(accent);
  scenery.group.position.y = 0.1;
  floating.add(scenery.group);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.85, 9.1);
  camera.lookAt(0, -0.72, 0);

  const isl = {
    visible: true,
    still,
    draw(t) {
      const w = Math.round(el.clientWidth * Math.min(2, window.devicePixelRatio || 1));
      const h = Math.round(el.clientHeight * Math.min(2, window.devicePixelRatio || 1));
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const r = sharedRenderer();
      const size = r.getSize(new THREE.Vector2());
      if (size.x < w || size.y < h) r.setSize(Math.max(size.x, w), Math.max(size.y, h), false);
      const full = r.getSize(new THREE.Vector2());
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      r.setViewport(0, 0, w, h);
      r.setScissor(0, 0, w, h);
      r.setScissorTest(true);

      floating.position.y = Math.sin(t * 1.3) * 0.09;
      floating.rotation.y = Math.sin(t * 0.45) * 0.42;
      floating.rotation.z = Math.sin(t * 0.8) * 0.025;
      beam.material.opacity = 0.12 + Math.sin(t * 2.2) * 0.05;
      scenery.update(t);
      for (const b of bits) {
        const k = (t * 0.22 + b.userData.off) % 1;
        const a = b.userData.a + t * 0.3;
        b.position.set(Math.cos(a) * 1.55, -0.3 + k * 2.6, Math.sin(a) * 0.9);
        b.scale.setScalar(0.42 + Math.sin(k * Math.PI) * 0.16);
        b.material.opacity = Math.sin(k * Math.PI) * 0.9;
      }

      r.render(scene, camera);
      ctx.clearRect(0, 0, w, h);
      // Видовий прямокутник WebGL лежить у нижньому лівому куті полотна рендерера.
      ctx.drawImage(r.domElement, 0, full.y - h, w, h, 0, 0, w, h);
    },
  };

  const io = new IntersectionObserver(([e]) => { isl.visible = e.isIntersecting; if (isl.visible) kick(); }, { rootMargin: '120px' });
  io.observe(el);
  live.add(isl);
  if (still) isl.draw(1.2);
  kick();
  // Шрифт номера міг довантажитись пізніше: перемалювати табличку.
  document.fonts?.ready.then(() => { if (still && live.has(isl)) isl.draw(1.2); });

  return () => {
    live.delete(isl);
    io.disconnect();
    canvas.remove();
    scene.traverse((o) => {
      o.geometry?.dispose();
      const m = o.material;
      if (m) for (const x of [].concat(m)) { if (x.map && ![...glyphTex.values()].includes(x.map)) x.map.dispose(); x.dispose(); }
    });
  };
}
