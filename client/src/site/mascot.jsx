/*
 * Маскот школи — розгорнутий підручник, як на заставці входу: тверда палітурка з товщиною, блок сторінок зі зрізом,
 * чисті сторінки дугою до корінця з тінню в згині, каптал;
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
          <stop offset="0" stopColor="#f7f2e9" />
          <stop offset="0.72" stopColor="#f1ebe1" />
          <stop offset="1" stopColor="#cdbfac" />
        </linearGradient>
        <linearGradient id="bk-right" x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="#fbf8f2" />
          <stop offset="0.72" stopColor="#f4efe7" />
          <stop offset="1" stopColor="#d3c6b4" />
        </linearGradient>
        <linearGradient id="bk-board" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#e5503a" />
          <stop offset="1" stopColor="#c8321f" />
        </linearGradient>
      </defs>
      {/* тінь на землі */}
      <ellipse className="s-mascot-ground" cx="60" cy="114" rx="30" ry="3.5" />
      {/* ніжки: зʼявляються, коли книжка вже розгорнулась */}
      <g className="s-mascot-limb is-legs">
        <g className="s-mascot-foot is-l"><path d="M52 99 L49 111 L42 111" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></g>
        <g className="s-mascot-foot is-r"><path d="M68 99 L71 111 L78 111" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></g>
      </g>
      <g className="s-mascot-body">
        {/* ліва ручка */}
        <g className="s-mascot-limb is-arm-l"><path d="M15 52 L4 67" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" /></g>
        {/* права половина: тверда палітурка з товщиною, блок сторінок зі зрізом, сторінка дугою до корінця */}
        <g className="s-mascot-half is-r">
          <path d="M60 34 C66 27 82 23 106 25 L106 96 C82 94 66 99 60 106 Z" fill="#9e2416" />
          <path d="M60 32 C66 25 82 21 106 23 L106 93 C82 91 66 96 60 103 Z" fill="url(#bk-board)" />
          <path d="M60 28 C65 19 80 15 101 18 L101 89 C80 86 65 90 60 97 Z" fill="#ebe2d3" />
          <path d="M60 93 C65 86 80 82 101 85 M60 95 C65 88 80 84 101 87 M99.5 20 V86" fill="none" stroke="#d2c4b0" strokeWidth="0.7" />
          <path d="M60 27 C65 18 80 14 99 17 L99 83 C80 80 65 84 60 91 Z" fill="url(#bk-right)" />
        </g>
        {/* ліва половина — під час появи розгортається від корінця */}
        <g className="s-mascot-half is-l">
          <path d="M60 34 C54 27 38 23 14 25 L14 96 C38 94 54 99 60 106 Z" fill="#9e2416" />
          <path d="M60 32 C54 25 38 21 14 23 L14 93 C38 91 54 96 60 103 Z" fill="url(#bk-board)" />
          <path d="M60 28 C55 19 40 15 19 18 L19 89 C40 86 55 90 60 97 Z" fill="#ebe2d3" />
          <path d="M19 85 C40 82 55 86 60 93 M19 87 C40 84 55 88 60 95 M20.5 20 V86" fill="none" stroke="#d2c4b0" strokeWidth="0.7" />
          <path d="M60 27 C55 18 40 14 21 17 L21 83 C40 80 55 84 60 91 Z" fill="url(#bk-left)" />
        </g>
        {/* корінець, згин і каптал */}
        <path d="M55.5 99 Q60 107 64.5 99 L64.5 103 Q60 110 55.5 103 Z" fill="#9e2416" />
        <path d="M60 27 V91" stroke="#bfb19c" strokeWidth="1" />
        <path d="M57.6 26.5 Q60 23.5 62.4 26.5" fill="none" stroke="#c8321f" strokeWidth="1.8" strokeLinecap="round" />
        {/* обличчя: змінюється, коли перегортається сторінка */}
        <g className="s-mascot-limb is-face"><Face kind={FACES[face]} /></g>
        {flip > 0 && <path key={flip} className="s-mascot-flip" d="M60 27 C65 18 80 14 99 17 L99 83 C80 80 65 84 60 91 Z" />}
        {/* обкладинка закритої книжки: під час появи відкривається */}
        <g className="s-mascot-closed">
          <path d="M60 32 C66 25 82 21 106 23 L106 93 C82 91 66 96 60 103 Z" fill="url(#bk-board)" />
          <rect x="72" y="40" width="22" height="12" rx="3" fill="#f4efe7" opacity="0.9" />
          <path d="M76 58 H90 M78 63 H88" stroke="#f4efe7" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        </g>
      </g>
      {/* права ручка — махає */}
      <g className="s-mascot-limb is-arm-r"><g className="s-mascot-arm"><path d="M105 52 L116 37" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" /></g></g>
    </svg>
  );
}
