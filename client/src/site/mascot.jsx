/*
 * Маскот школи — розгорнутий підручник, як на заставці входу: чисті кремові сторінки, палітурка в кольорі бренду,
 * ручки й ніжки — прості лінії, очі — чорні крапки, рот — проста усмішка.
 * Анімації (кліпає, махає ручкою, дихає, на бігу перебирає ніжками) — у site.css (.s-mascot).
 */
import { useEffect, useState } from 'react';
import { prefersCalm } from './motion.jsx';

const INK = '#1d1733';
const FACES = ['smile', 'wink', 'surprised', 'happy'];
const FACE_EVERY = 3200; // мс між виразами
const FLIP_HALF = 300; // вираз міняється, коли сторінка посередині

/** Вирази обличчя. Очі — чорні крапки або дужки, рот — проста лінія, без язика. */
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

export function Book() {
  const [face, flip] = useFaces();
  return (
    <svg className="s-mascot-svg" viewBox="0 0 120 116" aria-hidden="true">
      <defs>
        <linearGradient id="bk-left" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#f6f1e8" />
          <stop offset="0.8" stopColor="#f1ebe1" />
          <stop offset="1" stopColor="#ddd3c4" />
        </linearGradient>
        <linearGradient id="bk-right" x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="#fbf8f2" />
          <stop offset="0.8" stopColor="#f4efe7" />
          <stop offset="1" stopColor="#e2d9cb" />
        </linearGradient>
      </defs>
      {/* тінь на землі */}
      <ellipse className="s-mascot-ground" cx="60" cy="113" rx="26" ry="3.5" />
      {/* ніжки */}
      <g className="s-mascot-foot is-l"><path d="M52 94 L49 110 L42 110" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="s-mascot-foot is-r"><path d="M68 94 L71 110 L78 110" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="s-mascot-body">
        {/* ліва ручка */}
        <path d="M20 52 L9 67" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
        {/* палітурка */}
        <path className="s-mascot-cover" d="M60 31 Q42 19 16 21 L16 89 Q42 87 60 97 Q78 87 104 89 L104 21 Q78 19 60 31 Z" />
        {/* зріз сторінок під кожною половиною */}
        <path d="M60 29 Q43 17 19 19 L19 85 Q43 83 60 93 Q77 83 101 85 L101 19 Q77 17 60 29 Z" fill="#e6dccd" />
        {/* розгорнуті сторінки, чисті */}
        <path d="M60 26 Q43 14 21 16 L21 82 Q43 80 60 90 Z" fill="url(#bk-left)" />
        <path d="M60 26 Q77 14 99 16 L99 82 Q77 80 60 90 Z" fill="url(#bk-right)" />
        <path d="M60 26 V90" stroke="#cfc3b2" strokeWidth="1.2" />
        {/* обличчя: змінюється, коли перегортається сторінка */}
        <Face kind={FACES[face]} />
        {flip > 0 && <path key={flip} className="s-mascot-flip" d="M60 26 Q77 14 99 16 L99 82 Q77 80 60 90 Z" />}
      </g>
      {/* права ручка — махає */}
      <g className="s-mascot-arm"><path d="M100 52 L111 37" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" /></g>
    </svg>
  );
}
