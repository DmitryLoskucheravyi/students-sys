/*
 * Тривимірна книга для заставки входу (three.js, вантажиться лише на сторінці входу).
 * Будова: дві тверді палітурки з товщиною, блок сторінок зі смугастим зрізом, корінець,
 * три сторінки, що вигинаються під час гортання. Хореографія за часом t ∈ [0, 1]:
 * вилітає закритою → розгортається → гортає сторінки → гортає назад → згортається → оберт і виліт.
 * Фаза пишеться в data-phase і data-seen обгортки: так її перевіряють тести.
 */
import * as THREE from 'three';

const W = 1.4;      // ширина сторінки
const H = 2;        // висота сторінки
const T = 0.26;     // товщина блоку сторінок (обидві половини разом)
const C = 0.05;     // товщина палітурки
const O = 0.06;     // наскільки палітурка більша за сторінки
const PAGES = 3;
const SEG = 18;     // сегменти сторінки по ширині: для вигину
const DELAY = 1700;
const DURATION = 5800;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const smoother = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const span = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;

/** Значення з ключових кадрів [[t, ...values]] із плавним переходом між ними. */
function keyed(frames, t) {
  if (t <= frames[0][0]) return frames[0].slice(1);
  for (let i = 1; i < frames.length; i++) {
    const [t1, ...b] = frames[i];
    if (t <= t1) {
      const [t0, ...a] = frames[i - 1];
      const k = smoother((t - t0) / (t1 - t0));
      return a.map((v, j) => lerp(v, b[j], k));
    }
  }
  return frames[frames.length - 1].slice(1);
}

/* Текстури малюються на canvas: без зовнішніх файлів */
function texture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const MONO = '"Cascadia Mono", Consolas, "SFMono-Regular", Menlo, monospace';
const PAPER = '#f1ebe1';
// Сторінки трохи притемнені: на червоному тлі чисто білий папір світився
const PAGE_TINT = '#efe9df';
const RED = '#f2732c'; // акцент книжки — помаранчевий, як у маскота сайту
const MASCOT = '#f47a2e'; // палітурка маскота сайту

const PAGE_TEXT = [
  ['function grow(mind) {', '  while (curious) {', '    mind.learn();', '    mind.try();', '  }', '  return smart;', '}', '', '// be smart', 'grow(you);'],
  ['# 0 1 1 0 1', '', 'const code = [0, 1];', '', 'for (const bit of code) {', '  think(bit);', '}', '', '/* урок 7 */', 'export default code;'],
  ['class Student {', '  constructor(name) {', '    this.name = name;', '    this.xp = 0;', '  }', '  level() {', '    return ++this.xp;', '  }', '}', ''],
  ['<section>', '  <h1>Hello</h1>', '  <p>world</p>', '</section>', '', 'h1 {', '  color: red;', '}', '', '// 1 0 1 1'],
];

/** Сторінка з кодом. gutter: де корінець ('left' чи 'right'), щоб затінити біля нього. */
function pageTexture(lines, gutter, number, mirror = false) {
  return texture(512, 732, (g, w, h) => {
    if (mirror) { g.translate(w, 0); g.scale(-1, 1); }
    g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
    // Тінь біля корінця й легке старіння країв
    const gx = gutter === 'left' ? 0 : w;
    const sh = g.createLinearGradient(gx, 0, gutter === 'left' ? 90 : w - 90, 0);
    sh.addColorStop(0, 'rgba(120, 90, 70, 0.28)'); sh.addColorStop(1, 'rgba(120, 90, 70, 0)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    const pad = gutter === 'left' ? 70 : 46;
    g.font = `500 21px ${MONO}`;
    g.textBaseline = 'top';
    lines.forEach((line, i) => {
      const y = 70 + i * 44;
      g.fillStyle = '#b9aea4';
      g.fillText(String(i + 1).padStart(2, '0'), pad, y);
      const kw = /^(\s*)(function|const|for|return|class|export|while|this|constructor)\b/.exec(line);
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('#')) {
        g.fillStyle = '#9a8f86'; g.fillText(line, pad + 42, y);
      } else if (kw) {
        const head = kw[1] + kw[2];
        g.fillStyle = RED; g.fillText(head, pad + 42, y);
        g.fillStyle = '#2b2326'; g.fillText(line.slice(head.length), pad + 42 + g.measureText(head).width, y);
      } else {
        g.fillStyle = '#2b2326'; g.fillText(line, pad + 42, y);
      }
    });
    g.fillStyle = '#a3978d'; g.font = `500 18px ${MONO}`; g.textAlign = 'center';
    g.fillText(String(number), w / 2, h - 56);
  });
}

/** Зріз блоку сторінок: тонкі смуги паперу. across: смуги впоперек осі u чи v. */
function edgeTexture(across) {
  return texture(across === 'u' ? 256 : 8, across === 'u' ? 8 : 256, (g, w, h) => {
    g.fillStyle = '#efe6d8'; g.fillRect(0, 0, w, h);
    const n = 60;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 3 ? 'rgba(160, 140, 115, 0.22)' : 'rgba(255, 255, 255, 0.5)';
      if (across === 'u') g.fillRect((i / n) * w, 0, 1.4, h);
      else g.fillRect(0, (i / n) * h, w, 1.4);
    }
  });
}

/** Обкладинка: тканина, червона смуга біля корінця, тиснений знак і назва. */
function coverTexture(front) {
  return texture(560, 800, (g, w, h) => {
    g.fillStyle = '#f4efe7'; g.fillRect(0, 0, w, h);
    // Фактура тканини: дрібна сітка з шумом
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '120,100,80'}, ${Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    for (let y = 0; y < h; y += 4) { g.fillStyle = 'rgba(120, 100, 80, 0.04)'; g.fillRect(0, y, w, 1); }
    const band = 64;
    g.fillStyle = RED;
    g.fillRect(front ? 0 : w - band, 0, band, h);
    if (!front) return;
    // Тиснення: світла кромка зверху-ліворуч і тінь знизу-праворуч
    const emboss = (draw) => {
      g.save(); g.translate(-1.5, -1.5); g.fillStyle = 'rgba(255,255,255,0.9)'; draw(); g.restore();
      g.save(); g.translate(2, 2); g.fillStyle = 'rgba(90, 0, 15, 0.35)'; draw(); g.restore();
      g.fillStyle = RED; draw();
    };
    g.textAlign = 'center'; g.textBaseline = 'middle';
    emboss(() => { g.font = `800 150px ${MONO}`; g.fillText('</>', w / 2 + band / 2, h * 0.4); });
    emboss(() => { g.font = '800 40px "Unbounded Variable", "Arial Black", sans-serif'; g.fillText('BE SMART', w / 2 + band / 2, h * 0.62); });
    g.fillStyle = 'rgba(214, 21, 47, 0.55)'; g.fillRect(w / 2 + band / 2 - 70, h * 0.68, 140, 4);
    g.font = `600 22px ${MONO}`; g.fillStyle = '#8c8077'; g.fillText('0 1 1 0 1', w / 2 + band / 2, h * 0.74);
  });
}

/** М'яка тінь на фоні під книгою. */
function shadowTexture() {
  return texture(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(40, 0, 8, 0.55)'); r.addColorStop(0.55, 'rgba(40, 0, 8, 0.22)'); r.addColorStop(1, 'rgba(40, 0, 8, 0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
}

/* ───────── Обличчя маскота: малюється прямо на сторінках ─────────
 * Обличчя лежить на розвороті: ліве око й половина рота на лівій сторінці, решта — на правій.
 * Координати — як у колишньому SVG (viewBox 120×116, сторінки від y=16 до y=88, розворот від x=9 до x=111).
 */
const INK = '#1d1733';
const FACES = ['smile', 'wink', 'surprised', 'happy'];
const FW = 512; const FH = 732; // полотно однієї сторінки (пропорції W:H)
const FK = (2 * FW) / 102;      // одиниця SVG → пікселі полотна: розворот 102 одиниці на дві сторінки

/** Вираз kind у координатах SVG. blink: очі-крапки на мить заплющені. */
function drawFace(g, kind, blink) {
  const line = (d, width = 2.6) => {
    g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK; g.stroke(new Path2D(d));
  };
  const dot = (x, y, r) => {
    if (blink) { line(`M${x - r} ${y} L${x + r} ${y}`); return; }
    g.fillStyle = INK; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  if (kind === 'happy') { line('M45 47 Q49 42 53 47'); line('M67 47 Q71 42 75 47'); }
  else if (kind === 'surprised') { dot(49, 46, 4.6); dot(71, 46, 4.6); line('M44 37 Q49 34 54 37 M66 37 Q71 34 76 37', 2.2); }
  else if (kind === 'wink') { dot(49, 46, 3.8); line('M67 46.5 Q71 43.5 75 46.5'); }
  else { dot(49, 46, 3.8); dot(71, 46, 3.8); }
  g.globalAlpha = 0.6; g.fillStyle = '#ff8fa3';
  [40, 80].forEach((x) => { g.beginPath(); g.arc(x, 57, 3.6, 0, Math.PI * 2); g.fill(); });
  g.globalAlpha = 1;
  if (kind === 'surprised') line('M56.6 59 A3.4 4 0 1 0 63.4 59 A3.4 4 0 1 0 56.6 59');
  else if (kind === 'happy') { g.fillStyle = INK; g.fill(new Path2D('M51 55 Q60 66 69 55 Z')); }
  else line('M53 56 Q60 63 67 56');
}

/**
 * Сторінка маскота — полотно, яке можна перемальовувати: папір, тінь біля корінця й половина обличчя.
 * gutter: де корінець; mirror: зворотний бік сторінки (текстура дзеркалиться, тож малюємо як бачить глядач).
 * tex.paint(kind, blink): kind — вираз або null (чиста сторінка).
 */
function facePage(gutter, mirror = false) {
  const c = document.createElement('canvas');
  c.width = FW; c.height = FH;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.paint = (kind, blink = false) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (mirror) { g.translate(FW, 0); g.scale(-1, 1); }
    g.fillStyle = PAPER; g.fillRect(0, 0, FW, FH);
    const gx = gutter === 'left' ? 0 : FW;
    const sh = g.createLinearGradient(gx, 0, gutter === 'left' ? 96 : FW - 96, 0);
    sh.addColorStop(0, 'rgba(120, 90, 70, 0.3)'); sh.addColorStop(1, 'rgba(120, 90, 70, 0)');
    g.fillStyle = sh; g.fillRect(0, 0, FW, FH);
    if (kind) {
      // Ліва сторінка показує x від 9 до 60, права — від 60 до 111
      g.translate(gutter === 'right' ? 0 : -FW, 0);
      g.scale(FK, FK);
      g.translate(-9, -16);
      drawFace(g, kind, blink);
    }
    tex.needsUpdate = true;
  };
  tex.paint(null);
  return tex;
}

/** Помаранчева обкладинка маскота сайту: тканина, темніша смуга біля корінця, світлий знак. */
function mascotCover(front) {
  return texture(560, 800, (g, w, h) => {
    g.fillStyle = MASCOT; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '120,50,10'}, ${Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    const band = 64;
    g.fillStyle = '#d65f1d';
    g.fillRect(front ? 0 : w - band, 0, band, h);
    if (!front) return;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff4e6';
    g.font = `800 150px ${MONO}`; g.fillText('</>', w / 2 + band / 2, h * 0.42);
    g.font = '800 40px "Unbounded Variable", "Arial Black", sans-serif'; g.fillText('BE SMART', w / 2 + band / 2, h * 0.63);
  });
}

function buildBook({ mascot = false } = {}) {
  const paper = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.9 });
  const edgeU = new THREE.MeshStandardMaterial({ map: edgeTexture('u'), roughness: 0.95 });
  const edgeV = new THREE.MeshStandardMaterial({ map: edgeTexture('v'), roughness: 0.95 });
  const endpaper = new THREE.MeshStandardMaterial({ color: '#efe5d6', roughness: 0.9 });
  const cloth = new THREE.MeshStandardMaterial({ color: mascot ? MASCOT : '#f4efe7', roughness: 0.75 });
  const front = new THREE.MeshStandardMaterial({ map: mascot ? mascotCover(true) : coverTexture(true), roughness: 0.7 });
  const back = new THREE.MeshStandardMaterial({ map: mascot ? mascotCover(false) : coverTexture(false), roughness: 0.7 });
  const spineMat = new THREE.MeshStandardMaterial({ color: mascot ? '#d65f1d' : RED, roughness: 0.6 });
  // Сторінки: у маскота — полотна, на яких малюється обличчя (paint), на заставці входу — з кодом
  const pageMat = (lines, gutter, n, mirror) => new THREE.MeshStandardMaterial({
    map: mascot ? facePage(mirror ? 'right' : gutter, mirror) : pageTexture(lines, gutter, n, mirror), color: PAGE_TINT, roughness: 0.9 });

  const book = new THREE.Group();     // корінець у (0, 0, 0), сторінки лежать у площині XY, обличчям до камери (+z)
  const pivotZ = T / 2;               // вісь, навколо якої обертаються ліва половина й сторінки

  // Права половина: задня палітурка й половина блоку сторінок
  const coverGeo = new THREE.BoxGeometry(W + O, H + 2 * O, C);
  const backCover = new THREE.Mesh(coverGeo, [cloth, cloth, cloth, cloth, endpaper, back]);
  backCover.position.set((W + O) / 2, 0, -C / 2);
  const blockGeo = new THREE.BoxGeometry(W, H, T / 2);
  // Порядок граней Box: +x, -x, +y, -y, +z, -z
  const rightPage = pageMat(PAGE_TEXT[3], 'left', 8);
  const rightBlock = new THREE.Mesh(blockGeo, [edgeU, paper, edgeV, edgeV, rightPage, paper]);
  rightBlock.position.set(W / 2, 0, T / 4);
  book.add(backCover, rightBlock);

  // Ліва половина: обертається навколо осі (x=0, z=pivotZ). У розгорнутому стані лежить ліворуч
  const left = new THREE.Group();
  left.position.z = pivotZ;
  const frontCover = new THREE.Mesh(coverGeo, [cloth, cloth, cloth, cloth, endpaper, front]);
  frontCover.position.set(-(W + O) / 2, 0, -C / 2 - pivotZ);
  const leftPage = pageMat(PAGE_TEXT[0], 'right', 1);
  const leftBlock = new THREE.Mesh(blockGeo, [paper, edgeU, edgeV, edgeV, leftPage, paper]);
  leftBlock.position.set(-W / 2, 0, T / 4 - pivotZ);
  left.add(frontCover, leftBlock);
  book.add(left);

  // Корінець: у закритій книзі на всю товщину, у розгорнутій сплющується під розворотом
  const spine = new THREE.Mesh(new THREE.BoxGeometry(C, H + 2 * O, 1), spineMat);
  spine.position.x = -C / 2;
  book.add(spine);

  // Сторінки, що гортаються: спільна геометрія для лицьового й зворотного боку
  const pages = [];
  for (let i = 0; i < PAGES; i++) {
    const geo = new THREE.PlaneGeometry(W, H, SEG, 1);
    geo.translate(W / 2, 0, 0);
    const base = Float32Array.from(geo.attributes.position.array);
    const frontMat = pageMat(PAGE_TEXT[(i + 1) % 4], 'left', 2 * i + 3);
    frontMat.side = THREE.FrontSide;
    const backMat = pageMat(PAGE_TEXT[(i + 2) % 4], 'right', 2 * i + 2, true);
    backMat.side = THREE.BackSide;
    const g = new THREE.Group();
    g.position.z = pivotZ;
    g.add(new THREE.Mesh(geo, frontMat), new THREE.Mesh(geo, backMat));
    book.add(g);
    // Праворуч верхня — перша сторінка, ліворуч вона ж лягає найнижче
    pages.push({ geo, base, group: g, front: frontMat.map, back: backMat.map, offR: 0.006 * (PAGES - i), offL: 0.006 * (i + 1) });
  }

  /**
   * Вигин сторінки: f — перегорнутість 0..1, кут θ = π·o·f (ліва половина розгорнута на π·o,
   * тож сторінка лягає саме на неї, а не провалюється в лівий блок). Край відстає від корінця.
   */
  const bendPage = (p, f, o) => {
    const theta = Math.PI * o * f;
    const pos = p.geo.attributes.position;
    const curl = 0.95 * Math.sin(Math.PI * f);
    const ds = W / SEG;
    let x = 0; let z = 0;
    const xs = [0]; const zs = [0];
    for (let k = 0; k < SEG; k++) {
      const phi = theta - curl * Math.pow((k + 0.5) / SEG, 1.6);
      x += ds * Math.cos(phi); z += ds * Math.sin(phi);
      xs.push(x); zs.push(z);
    }
    // Зсув по нормалі: праворуч — над правим блоком, ліворуч — над лівим (нормаль сторінки там дивиться вниз,
    // тому знак міняється). Раніше зсув лишався «вниз» і перегорнута сторінка ховалась у лівому блоці.
    const off = lerp(p.offR, -p.offL, f);
    const nx = -Math.sin(theta) * off; const nz = Math.cos(theta) * off;
    for (let v = 0; v < pos.count; v++) {
      const col = Math.round((p.base[v * 3] / W) * SEG);
      pos.setXYZ(v, xs[col] + nx, p.base[v * 3 + 1], zs[col] + nz);
    }
    pos.needsUpdate = true;
    p.geo.computeVertexNormals();
  };

  /** o: наскільки розгорнута (0..1), flips: кут кожної сторінки 0..1. */
  const pose = (o, flips) => {
    left.rotation.y = Math.PI * (1 - o);
    const closed = 1 - o;
    const depth = lerp(0.02, T + 2 * C, closed);
    spine.scale.z = depth;
    spine.position.z = -C + depth / 2;
    pages.forEach((p, i) => bendPage(p, flips[i], o));
  };

  const dispose = () => book.traverse((m) => {
    if (!m.isMesh) return;
    m.geometry.dispose();
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => { mat.map?.dispose(); mat.dispose(); });
  });
  const sheets = { left: leftPage.map, right: rightPage.map, pages };
  return { book, pose, dispose, sheets };
}

/*
 * Траєкторія в частках полотна: u зліва, v згори. На широкому екрані полотно — уся сторінка:
 * книга виринає знизу зліва, розгортається над лівою панеллю й вилітає вгору через червоний виступ праворуч, повз форму.
 * На низькій панелі телефона книга летить над лого праворуч.
 */
const PATH_WIDE = [[-0.08, 1.08], [0.11, 0.62], [0.25, 0.42], [0.34, 0.37], [0.56, 0.15], [0.76, -0.3]];
const PATH_LOW = [[-0.1, 1.2], [0.52, 0.34], [0.8, 0.24], [0.86, 0.22], [1.0, 0.06], [1.2, -0.45]];
const REST_WIDE = [0.4, 0.27];
const REST_LOW = [0.76, 0.27];

/**
 * Монтує сцену в елемент. Повертає функцію, що все прибирає.
 * still: без анімації, розгорнута книга спокійно лежить угорі праворуч.
 */
export function mountBook(el, { still = false, startAt = performance.now() } = {}) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 14);
  scene.add(new THREE.HemisphereLight('#ffffff', '#e2dcf3', 1.4));
  const key = new THREE.DirectionalLight('#fff6ec', 2.4);
  key.position.set(-4, 6, 9);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#d9d0ff', 0.8);
  rim.position.set(6, -3, 4);
  scene.add(rim);

  const { book, pose, dispose } = buildBook();
  const holder = new THREE.Group();   // позиція й масштаб
  const turn = new THREE.Group();     // нахил і оберти
  const center = new THREE.Group();   // центрування: закрита книга займає лише праву половину
  center.add(book); turn.add(center); holder.add(turn);
  scene.add(holder);

  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  shadow.position.z = -3;
  scene.add(shadow);

  let view = { w: 1, h: 1, halfH: 1, halfW: 1, low: false };
  const resize = () => {
    const w = el.clientWidth || 1; const h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    view = { w, h, halfH, halfW: halfH * camera.aspect, low: h < 320 };
  };
  const toWorld = ([u, v]) => new THREE.Vector3((u * 2 - 1) * view.halfW, (1 - v * 2) * view.halfH, 0);
  // Висота книги на екрані в пікселях → масштаб сцени
  const bookScale = () => {
    const px = view.low ? Math.max(46, view.h * 0.26) : Math.min(240, Math.max(110, view.h * 0.25));
    return (px * (2 * view.halfH / view.h)) / H;
  };

  const setPhase = (phase) => {
    el.dataset.phase = phase;
    const seen = new Set((el.dataset.seen || '').split(',').filter(Boolean));
    seen.add(phase);
    el.dataset.seen = [...seen].join(',');
  };

  const frame = (t) => {
    // Розгорнутість: 0 закрита, 1 розгорнута
    const o = smoother(span(t, 0.13, 0.31)) * (1 - smoother(span(t, 0.66, 0.8)));
    const flips = Array.from({ length: PAGES }, (_, i) =>
      smoother(span(t, 0.27 + 0.045 * i, 0.39 + 0.045 * i)) * (1 - smoother(span(t, 0.52 + 0.03 * (PAGES - 1 - i), 0.62 + 0.03 * (PAGES - 1 - i)))));
    pose(o, flips);
    center.position.x = -(W / 2) * (1 - o);

    // Шлях: повільно посередині, розгін на вильоті
    // Параметр кривої: точки рівномірно по 0.2, тож зависання між 2-ю і 3-ю точкою (0.4..0.6)
    const s = t < 0.4 ? lerp(0, 0.4, 1 - (1 - t / 0.4) ** 2)
      : t < 0.68 ? lerp(0.4, 0.6, (t - 0.4) / 0.28)
        : lerp(0.6, 1, ((t - 0.68) / 0.32) ** 2);
    const curve = new THREE.CatmullRomCurve3((view.low ? PATH_LOW : PATH_WIDE).map(toWorld));
    holder.position.copy(curve.getPoint(clamp01(s)));
    const [rx, ry, rz, sc] = keyed([
      [0, -1.05, -1.15, -0.75, 0.72],
      [0.3, -0.42, -0.12, -0.1, 1.08],
      [0.66, -0.38, 0.14, 0.06, 1.08],
      [1, -1.15, 0.95, 0.06 + Math.PI * 2, 0.72],
    ], t);
    turn.rotation.set(rx, ry, rz);
    holder.scale.setScalar(sc * bookScale());

    const size = holder.scale.x * (W * (1 + o) + 0.3);
    shadow.position.set(holder.position.x + 0.22 * size, holder.position.y - 0.3 * size, -3);
    shadow.scale.set(size * 1.25, size * 0.95, 1);
    shadowMat.opacity = 0.8;

    setPhase(t >= 1 ? 'gone' : o > 0.95 ? 'open' : o < 0.05 ? (t < 0.5 ? 'closed' : 'closing') : 'turning');
    renderer.render(scene, camera);
  };

  const still_ = () => {
    resize();
    pose(1, [1, 0, 0]);
    center.position.x = 0;
    holder.position.copy(toWorld(view.low ? REST_LOW : REST_WIDE));
    turn.rotation.set(-0.42, -0.1, -0.12);
    holder.scale.setScalar(bookScale() * 0.9);
    const size = holder.scale.x * (2 * W + 0.3);
    shadow.position.set(holder.position.x + 0.22 * size, holder.position.y - 0.3 * size, -3);
    shadow.scale.set(size * 1.25, size * 0.95, 1);
    setPhase('still');
    renderer.render(scene, camera);
  };

  let raf = 0;
  let done = false;
  const ro = new ResizeObserver(() => { resize(); if (still) still_(); });
  ro.observe(el);
  resize();

  const cleanup = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    dispose();
    shadow.geometry.dispose(); shadowMat.map.dispose(); shadowMat.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    delete el.bookSeek;
  };

  if (still) {
    still_();
  } else {
    setPhase('wait');
    let paused = false;
    // Перемотування для тестів і перевірки кадрів: зупиняє політ і малює мить t ∈ [0, 1]
    el.bookSeek = (t) => { paused = true; cancelAnimationFrame(raf); if (!done) frame(clamp01(t)); };
    const tick = (now) => {
      if (paused) return;
      const t = (now - startAt - DELAY) / DURATION;
      if (t < 0) { raf = requestAnimationFrame(tick); return; }
      frame(Math.min(t, 1));
      if (t >= 1) { done = true; cleanup(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  return () => { if (!done) { done = true; cleanup(); } };
}


/* ───────── Маскот сайту ───────── */

const MASCOT_OPEN = 0.8; // не до кінця: стоїть розгорнута «галочкою» до глядача
const ENTER_MS = 3200;
const FLIP_MS = 700;     // як одна сторінка на заставці входу
const BLINK_EVERY = 4200;
const BLINK_MS = 130;

/**
 * Та сама книжка в ролі маскота сайту. Полотно ширше за маскота (.bk3d виходить за його межі ліворуч, угору й униз),
 * щоб книжка залітала здалеку, а не вигулькувала з невидимого краю.
 * Поява як на заставці входу: закрита вилітає знизу зліва з обертом, розгортається, гортає три сторінки —
 * на останній зʼявляється обличчя. Далі ширяє (CSS) і кожним flip() перегортає сторінку: під нею вже намальований
 * наступний вираз, тож міміка міняється разом зі сторінкою, а не поверх неї. Очі час від часу кліпають.
 * Повертає { flip, destroy }. still: одразу розгорнута з обличчям, без руху.
 */
export function mountMascot(el, { still = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 14);
  scene.add(new THREE.HemisphereLight('#ffffff', '#ece8f7', 2.1));
  const key = new THREE.DirectionalLight('#fffaf2', 2.6);
  key.position.set(-2, 5, 11);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#d9d0ff', 0.7);
  rim.position.set(6, -3, 4);
  scene.add(rim);

  const { book, pose, dispose, sheets } = buildBook({ mascot: true });
  const holder = new THREE.Group();
  const turn = new THREE.Group();
  const center = new THREE.Group();
  center.add(book); turn.add(center); holder.add(turn);
  scene.add(holder);

  // Де маскот на полотні: полотно більше за обгортку, тож міряємо зсув обгортки всередині нього
  let box = { k: 1, cx: 0, cy: 0, artH: 1 };
  const resize = () => {
    const w = el.clientWidth || 1; const h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const art = el.parentElement;
    const artW = art?.clientWidth || w; const artH = art?.clientHeight || h;
    const k = (2 * halfH) / h; // пікселі → одиниці сцени
    // Центр книжки — на 45 % висоти маскота згори (під це підігнано ручки й ніжки)
    box = { k, artH, cx: (-el.offsetLeft + artW / 2 - w / 2) * k, cy: (h / 2 - (-el.offsetTop + 0.45 * artH)) * k };
  };
  const scale = () => (0.62 * box.artH * box.k) / H; // сторінки — 62 % висоти маскота

  /* Обличчя. Поки сторінка лежить праворуч: ліва сторінка й лице верхньої — поточний вираз,
   * зворот верхньої й сторінка під нею — наступний. */
  const [p0, p1, p2] = sheets.pages;
  let face = 0;
  const next = () => (face + 1) % FACES.length;
  const paintIdle = (blink = false) => {
    sheets.left.paint(FACES[face], blink);
    p0.front.paint(FACES[face], blink);
    p0.back.paint(FACES[next()]);
    sheets.right.paint(FACES[next()]);
  };
  const toIdle = () => {
    p1.group.visible = false; p2.group.visible = false;
    paintIdle();
  };

  let mode = 'enter';
  let enter = 0;
  let pageF = 0;

  /** Кадр появи: e 0..1. Хореографія й нахили — із заставки входу. */
  const drawEnter = (e) => {
    const v = smoother(span(e, 0.2, 0.52));
    const o = MASCOT_OPEN * v;
    // Три сторінки одна за одною, як на вході
    pose(o, [0, 1, 2].map((i) => smoother(span(e, 0.46 + 0.08 * i, 0.68 + 0.08 * i))));
    center.position.x = -(W / 2) * (1 - v);
    // x, y — у висотах маскота від місця спокою; повороти й масштаб — як на вході, далі осідає
    const [x, y, rx, ry, rz, sc] = keyed([
      [0, -0.85, -0.75, -1.05, -1.15, -0.75, 0.72],
      [0.2, -0.36, -0.22, -0.7, -0.6, -0.4, 0.92],
      [0.46, -0.03, -0.06, -0.42, -0.12, -0.1, 1.08],
      [0.78, 0, -0.03, -0.3, -0.04, -0.03, 1.03],
      [1, 0, 0, -0.2, 0, 0, 1],
    ], e);
    holder.position.set(box.cx + x * box.artH * box.k, box.cy - y * box.artH * box.k, 0);
    // Розгорнута «галочкою»: обидві половини однаково повернуті до глядача
    turn.rotation.set(rx, ry - ((Math.PI * (1 - o)) / 2) * v, rz);
    holder.scale.setScalar(sc * scale());
    el.style.opacity = String(smooth(e / 0.1));
    renderer.render(scene, camera);
  };

  /** Спокій: розгорнута, верхня сторінка перегорнута на f. */
  const drawIdle = (f) => {
    pose(MASCOT_OPEN, [f, 0, 0]);
    center.position.x = 0;
    holder.position.set(box.cx, box.cy, 0);
    turn.rotation.set(-0.2, -(Math.PI * (1 - MASCOT_OPEN)) / 2, 0); // «галочкою»: обидві половини рівно
    holder.scale.setScalar(scale());
    renderer.render(scene, camera);
  };
  const draw = () => (mode === 'enter' ? drawEnter(enter) : drawIdle(pageF));

  let raf = 0;
  let blinkTimer = 0;
  const ro = new ResizeObserver(() => { resize(); draw(); });
  ro.observe(el);
  resize();

  const blink = () => {
    // Лише в спокої, коли видно (інакше марно перемальовувати), і не для «щасливого» — там очі вже дужками
    const r = el.getBoundingClientRect();
    if (mode !== 'idle' || document.hidden || r.bottom < 0 || r.top > innerHeight || FACES[face] === 'happy') return;
    paintIdle(true); draw();
    setTimeout(() => { if (mode === 'idle') { paintIdle(); draw(); } }, BLINK_MS);
  };
  const idle = () => {
    mode = 'idle';
    toIdle(); draw();
    if (!still) blinkTimer = setInterval(blink, BLINK_EVERY);
  };

  if (still) idle();
  else {
    // Під час появи всі сторінки чисті, крім звороту останньої й сторінки під нею: там перший вираз
    p2.back.paint(FACES[0]);
    sheets.right.paint(FACES[0]);
    el.style.opacity = '0';
    const t0 = performance.now();
    const tick = (now) => {
      enter = clamp01((now - t0) / ENTER_MS);
      if (enter < 1) { drawEnter(enter); raf = requestAnimationFrame(tick); return; }
      el.style.opacity = '';
      idle();
    };
    raf = requestAnimationFrame(tick);
  }

  const flip = () => {
    if (mode !== 'idle') return;
    mode = 'flip';
    paintIdle(); // якщо саме кліпнув — розплющити
    const t0 = performance.now();
    const tick = (now) => {
      const k = clamp01((now - t0) / FLIP_MS);
      pageF = smoother(k);
      drawIdle(pageF);
      if (k < 1) { raf = requestAnimationFrame(tick); return; }
      // Сторінка лягла ліворуч: тепер увесь розворот — наступний вираз. Непомітно повертаємо її праворуч
      // з тим самим малюнком і готуємо під нею ще наступний
      face = next();
      pageF = 0;
      mode = 'idle';
      paintIdle();
      drawIdle(0);
    };
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };

  const destroy = () => {
    cancelAnimationFrame(raf);
    clearInterval(blinkTimer);
    mode = 'gone';
    ro.disconnect();
    dispose();
    renderer.dispose();
    renderer.domElement.remove();
    el.style.opacity = '';
  };
  return { flip, destroy };
}
