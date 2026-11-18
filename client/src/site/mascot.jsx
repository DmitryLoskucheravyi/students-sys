/*
 * Маскот школи — справжня 3D-книжка з заставки входу (book3d.js): помаранчева тверда палітурка, блок сторінок,
 * чисті сторінки; стоїть розгорнута «галочкою». Ручки й ніжки — прості лінії, очі — чорні крапки, рот — проста лінія.
 * Поява, як на вході: закрита залітає, осідає й розгортається; далі обличчя й кінцівки. Міміка — з перегортанням сторінки.
 */
import { useEffect, useRef, useState } from 'react';
import { prefersCalm } from './motion.jsx';

const INK = '#1d1733';
const FACES = ['smile', 'wink', 'surprised', 'happy'];
const FACE_EVERY = 3600; // мс між виразами
const FLIP_HALF = 330; // вираз міняється, коли сторінка посередині
const VB = '0 0 120 116';

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

/**
 * Маскот: справжня 3D-книжка з заставки входу (book3d.js, three.js вантажиться лише в браузері),
 * поверх — обличчя, ручки й ніжки. Поява й розгортання — у book3d.js; обличчя й кінцівки зʼявляються після,
 * коли на обгортці стоїть is-ready (CSS-затримки рахуються від нього). Міміка міняється, коли гортається сторінка.
 */
export function Book() {
  const ref = useRef(null);
  const [face, setFace] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const calm = prefersCalm();
    let api = null;
    let alive = true;
    let timer = 0;
    let half = 0;
    import('../book3d.js')
      .then(({ mountMascot }) => {
        if (!alive) return;
        api = mountMascot(el, { still: calm });
        setReady(true);
        if (calm) return;
        timer = setInterval(() => {
          api.flip();
          half = setTimeout(() => setFace((f) => (f + 1) % FACES.length), FLIP_HALF);
        }, FACE_EVERY);
      })
      .catch(() => { if (alive) setReady(true); }); // без WebGL: лишаються обличчя й кінцівки
    return () => { alive = false; clearInterval(timer); clearTimeout(half); api?.destroy(); };
  }, []);
  const limb = { fill: 'none', stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <div className={`s-mascot-art ${ready ? 'is-ready' : ''}`} aria-hidden="true">
      {/* ручки й ніжки — за книжкою */}
      <svg className="bk-limbs" viewBox={VB}>
        <ellipse className="s-mascot-ground" cx="60" cy="113" rx="34" ry="3.5" />
        <g className="s-mascot-foot is-l"><path className="bk-line" pathLength="1" d="M51 88 L48 111 L41 111" {...limb} /></g>
        <g className="s-mascot-foot is-r"><path className="bk-line" pathLength="1" d="M69 88 L72 111 L79 111" {...limb} /></g>
        <path className="bk-line" pathLength="1" d="M9 56 L-4 72" {...limb} />
        <g className="s-mascot-arm"><path className="bk-line" pathLength="1" d="M111 56 L124 40" {...limb} /></g>
      </svg>
      <div className="bk3d" ref={ref} />
      <svg className="bk-face" viewBox={VB}>
        <g key={face} className="bk-face-in"><Face kind={FACES[face]} /></g>
      </svg>
    </div>
  );
}
