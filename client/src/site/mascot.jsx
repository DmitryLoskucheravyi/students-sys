/*
 * Маскот школи — розгорнутий підручник у дусі книжки на заставці входу (book3d.js): прямі плоскі сторінки,
 * тверда палітурка з товщиною, справжній 3D-поворот обкладинки й сторінок (CSS 3D, без three.js).
 * Палітурка помаранчева, ручки й ніжки — прості лінії, очі — чорні крапки, рот — проста лінія.
 *
 * Поява: закрита книжка плавно залітає й стає на місце, обкладинка відкривається, далі зʼявляються обличчя,
 * ручки й ніжки. Міміка: раз на кілька секунд перегортається сторінка, і під нею новий вираз.
 * Усі рухи — у site.css (.s-mascot, .bk-*).
 */
import { useEffect, useState } from 'react';
import { prefersCalm } from './motion.jsx';

const INK = '#1d1733';
const FACES = ['smile', 'wink', 'surprised', 'happy'];
const FACE_EVERY = 3600; // мс між виразами
const FLIP_HALF = 330; // вираз міняється, коли сторінка посередині

/** Вирази обличчя (координати — як у шарі .bk-face, 120×116). */
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
      <circle cx="40" cy="56" r="3.6" fill="#ff8fa3" opacity="0.6" />
      <circle cx="80" cy="56" r="3.6" fill="#ff8fa3" opacity="0.6" />
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

/** Половина розгорнутої книжки: дошка палітурки, блок сторінок зі зрізом, сама сторінка. */
function Half({ side, children }) {
  return (
    <div className={`bk-half is-${side}`}>
      <i className="bk-board" />
      <i className="bk-block" />
      <i className="bk-page" />
      {children}
    </div>
  );
}

export function Book() {
  const [face, flip] = useFaces();
  const limb = { fill: 'none', stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <div className="s-mascot-art" aria-hidden="true">
      {/* ручки й ніжки — за книжкою */}
      <svg className="bk-limbs" viewBox="0 0 120 116">
        <ellipse className="s-mascot-ground" cx="60" cy="113" rx="30" ry="3.5" />
        <g className="s-mascot-foot is-l"><path className="bk-line" pathLength="1" d="M52 86 L49 110 L42 110" {...limb} /></g>
        <g className="s-mascot-foot is-r"><path className="bk-line" pathLength="1" d="M68 86 L71 110 L78 110" {...limb} /></g>
        <path className="bk-line" pathLength="1" d="M20 52 L6 68" {...limb} />
        <g className="s-mascot-arm"><path className="bk-line" pathLength="1" d="M100 52 L114 36" {...limb} /></g>
      </svg>
      <div className="bk">
        <div className="bk-book">
          <Half side="r">
            {flip > 0 && (
              <div key={flip} className="bk-flip">
                <i className="bk-flip-front" />
                <i className="bk-flip-back" />
              </div>
            )}
          </Half>
          {/* ліва половина: на старті лежить на правій (книжка закрита), видно обкладинку; потім відкривається */}
          <Half side="l">
            <div className="bk-cover">
              <span className="bk-cover-mark">{'</>'}</span>
              <span className="bk-cover-name">BE SMART</span>
            </div>
          </Half>
        </div>
      </div>
      <svg className="bk-face" viewBox="0 0 120 116">
        <Face kind={FACES[face]} />
      </svg>
    </div>
  );
}
