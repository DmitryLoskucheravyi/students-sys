/*
 * Маскот школи — розгорнутий підручник у дусі книжки на заставці входу (book3d.js): розгорнутий «галочкою»,
 * палітурки й сторінки — рівні тверді площини з товщиною (не вигнуті, як журнал), сторінки м'яко заходять у згин.
 * Палітурка помаранчева, ручки й ніжки — прості лінії, очі — чорні крапки, рот — проста лінія.
 *
 * Половинки — окремі шари, тож обкладинка відкривається і сторінка перегортається справжнім 3D-поворотом
 * навколо корінця (CSS 3D). Поява: закрита книжка плавно залітає, стає на місце й відкривається,
 * далі обличчя, ручки й ніжки. Міміка змінюється, коли перегортається сторінка. Рухи — у site.css (.bk-*).
 */
import { useEffect, useState } from 'react';
import { prefersCalm } from './motion.jsx';

const INK = '#1d1733';
const FACES = ['smile', 'wink', 'surprised', 'happy'];
const FACE_EVERY = 3600; // мс між виразами
const FLIP_HALF = 330; // вираз міняється, коли сторінка посередині
const VB = '0 0 120 116';

/* Геометрія (одна система координат 120×116 для всіх шарів). Корінець — x = 60. */
const L = {
  edge: 'M60 34 L14 26 L14 98 L60 106 Z', // товщина палітурки
  board: 'M60 31 L14 23 L14 95 L60 103 Z',
  block: 'M60 29 L18 20 L18 90 L60 99 Z', // блок сторінок
  stripes: 'M18 86.6 L60 95.6 M18 88.2 L60 97.2 M19.2 21.5 V87',
  page: 'M20 16 L53 22 Q58.5 23 60 27 L60 93 Q58.5 89 53 88 L20 84 Z',
};
const R = {
  edge: 'M60 34 L106 26 L106 98 L60 106 Z',
  board: 'M60 31 L106 23 L106 95 L60 103 Z',
  block: 'M60 29 L102 20 L102 90 L60 99 Z',
  stripes: 'M102 86.6 L60 95.6 M102 88.2 L60 97.2 M100.8 21.5 V87',
  page: 'M100 16 L67 22 Q61.5 23 60 27 L60 93 Q61.5 89 67 88 L100 84 Z',
};

function Defs() {
  return (
    <defs>
      <linearGradient id="bk-pl" gradientUnits="userSpaceOnUse" x1="20" x2="60" y1="0" y2="0">
        <stop offset="0" stopColor="#f7f2e9" />
        <stop offset="0.75" stopColor="#f1ebe1" />
        <stop offset="1" stopColor="#d5c8b5" />
      </linearGradient>
      <linearGradient id="bk-pr" gradientUnits="userSpaceOnUse" x1="100" x2="60" y1="0" y2="0">
        <stop offset="0" stopColor="#fbf8f2" />
        <stop offset="0.75" stopColor="#f4efe7" />
        <stop offset="1" stopColor="#d9ccba" />
      </linearGradient>
      <linearGradient id="bk-bd" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#ff9450" />
        <stop offset="1" stopColor="#f2732c" />
      </linearGradient>
    </defs>
  );
}

function HalfArt({ g }) {
  return (
    <>
      <path d={g.edge} fill="#c45a17" />
      <path d={g.board} fill="url(#bk-bd)" />
      <path d={g.block} fill="#e9dfcf" />
      <path d={g.stripes} fill="none" stroke="#d3c5b1" strokeWidth="0.6" />
      <path d={g.page} fill={g === L ? 'url(#bk-pl)' : 'url(#bk-pr)'} />
    </>
  );
}

/** Вирази обличчя. */
function Face({ kind }) {
  const line = { fill: 'none', stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <g className="s-mascot-face" key={kind}>
      {kind === 'happy' ? (
        <>
          <path d="M45 47 Q49 42 53 47" {...line} />
          <path d="M67 47 Q71 42 75 47" {...line} />
        </>
      ) : kind === 'surprised' ? (
        <g className="s-mascot-eyes">
          <circle cx="49" cy="46" r="4.6" fill={INK} />
          <circle cx="71" cy="46" r="4.6" fill={INK} />
          <path d="M44 37 Q49 34 54 37 M66 37 Q71 34 76 37" {...line} strokeWidth="2.2" />
        </g>
      ) : kind === 'wink' ? (
        <>
          <g className="s-mascot-eyes"><circle cx="49" cy="46" r="3.8" fill={INK} /></g>
          <path d="M67 46.5 Q71 43.5 75 46.5" {...line} />
        </>
      ) : (
        <g className="s-mascot-eyes">
          <circle cx="49" cy="46" r="3.8" fill={INK} />
          <circle cx="71" cy="46" r="3.8" fill={INK} />
        </g>
      )}
      <circle cx="40" cy="57" r="3.6" fill="#ff8fa3" opacity="0.6" />
      <circle cx="80" cy="57" r="3.6" fill="#ff8fa3" opacity="0.6" />
      {kind === 'surprised' ? <ellipse cx="60" cy="59" rx="3.4" ry="4" {...line} />
        : kind === 'happy' ? <path d="M51 55 Q60 66 69 55 Z" fill={INK} />
        : <path d="M53 56 Q60 63 67 56" {...line} />}
    </g>
  );
}

/** Міміка: раз на кілька секунд сторінка перегортається, і під нею вже новий вираз. */
function useFaces() {
  const [face, setFace] = useState(0);
  const [flip, setFlip] = useState(0);
  useEffect(() => {
    if (prefersCalm()) return undefined;
    let half = 0;
    const t = setInterval(() => {
      setFlip((n) => n + 1);
      half = setTimeout(() => setFace((f) => (f + 1) % FACES.length), FLIP_HALF);
    }, FACE_EVERY);
    return () => { clearInterval(t); clearTimeout(half); };
  }, []);
  return [face, flip];
}

export function Book() {
  const [face, flip] = useFaces();
  const limb = { fill: 'none', stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <div className="s-mascot-art" aria-hidden="true">
      {/* ручки й ніжки — за книжкою */}
      <svg className="bk-limbs" viewBox={VB}>
        <ellipse className="s-mascot-ground" cx="60" cy="113" rx="30" ry="3.5" />
        <g className="s-mascot-foot is-l"><path className="bk-line" pathLength="1" d="M52 100 L49 111 L42 111" {...limb} /></g>
        <g className="s-mascot-foot is-r"><path className="bk-line" pathLength="1" d="M68 100 L71 111 L78 111" {...limb} /></g>
        <path className="bk-line" pathLength="1" d="M16 54 L4 69" {...limb} />
        <g className="s-mascot-arm"><path className="bk-line" pathLength="1" d="M104 54 L116 38" {...limb} /></g>
      </svg>
      <div className="bk">
        <svg className="bk-layer" viewBox={VB}><Defs /><HalfArt g={R} /></svg>
        {/* ліва половина: на старті лежить на правій (книжка закрита) — видно обкладинку; потім відкривається */}
        <div className="bk-leaf">
          <svg className="bk-layer bk-front" viewBox={VB}><HalfArt g={L} /></svg>
          <svg className="bk-layer bk-back" viewBox={VB}>
            <path d={R.edge} fill="#c45a17" />
            <path d={R.board} fill="url(#bk-bd)" />
            <path d="M60 31 L67 29.8 L67 101.8 L60 103 Z" fill="#e5651f" />
            <text x="85" y="62" textAnchor="middle" fontSize="11" fontWeight="900" fontFamily="ui-monospace, Consolas, monospace" fill="#fff7ec" transform="skewY(-10) translate(0 15)">{'</>'}</text>
          </svg>
        </div>
        <svg className="bk-layer bk-spine" viewBox={VB}><path d="M60 27 V93" stroke="#c9bba6" strokeWidth="1" /></svg>
        {flip > 0 && (
          <div key={flip} className="bk-flip">
            <svg className="bk-layer bk-front" viewBox={VB}><path d={R.page} fill="url(#bk-pr)" /></svg>
            <svg className="bk-layer bk-back" viewBox={VB}><path d={L.page} fill="url(#bk-pl)" /></svg>
          </div>
        )}
      </div>
      <svg className="bk-face" viewBox={VB}>
        <g key={flip} className={flip ? 'bk-face-flip' : ''}><Face kind={FACES[face]} /></g>
      </svg>
    </div>
  );
}
