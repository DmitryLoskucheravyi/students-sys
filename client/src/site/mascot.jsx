/*
 * Маскот школи — справжня 3D-книжка з заставки входу (book3d.js): помаранчева тверда палітурка, блок сторінок;
 * стоїть розгорнута «галочкою». Обличчя намальоване на сторінках (book3d.js), ручки й ніжки — прості лінії (SVG тут).
 * Поява, як на вході: закрита вилітає, розгортається, гортає сторінки; далі ширяє, а вирази міняються перегортанням.
 */
import { useEffect, useRef, useState } from 'react';
import { prefersCalm } from './motion.jsx';

const INK = '#1d1733';
const FACE_EVERY = 3600; // мс між виразами: книжка перегортає сторінку, під нею — наступний вираз
const VB = '0 0 120 116';

/**
 * Маскот: справжня 3D-книжка з заставки входу (book3d.js, three.js вантажиться лише в браузері) з обличчям
 * на сторінках, позаду — ручки й ніжки. Кінцівки зʼявляються, коли книжка розгорнулась
 * (CSS-затримки рахуються від is-ready на обгортці).
 */
export function Book() {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const calm = prefersCalm();
    let api = null;
    let alive = true;
    let timer = 0;
    import('../book3d.js')
      .then(({ mountMascot }) => {
        if (!alive) return;
        api = mountMascot(el, { still: calm });
        setReady(true);
        if (calm) return;
        timer = setInterval(() => api.flip(), FACE_EVERY);
      })
      .catch(() => { if (alive) setReady(true); }); // без WebGL: лишаються кінцівки
    return () => { alive = false; clearInterval(timer); api?.destroy(); };
  }, []);
  const limb = { fill: 'none', stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <div className={`s-mascot-art ${ready ? 'is-ready' : ''}`} aria-hidden="true">
      <svg className="bk-ground" viewBox={VB}>
        <ellipse className="s-mascot-ground" cx="60" cy="113" rx="34" ry="3.5" />
      </svg>
      {/* ширяє разом: ручки й ніжки позаду, книжка (полотно three.js) поверх */}
      <div className="bk-body">
        <svg className="bk-limbs" viewBox={VB}>
          <g className="s-mascot-foot is-l"><path className="bk-line" pathLength="1" d="M51 88 L48 111 L41 111" {...limb} /></g>
          <g className="s-mascot-foot is-r"><path className="bk-line" pathLength="1" d="M69 88 L72 111 L79 111" {...limb} /></g>
          <path className="bk-line" pathLength="1" d="M9 56 L-4 72" {...limb} />
          <g className="s-mascot-arm"><path className="bk-line" pathLength="1" d="M111 56 L124 40" {...limb} /></g>
        </svg>
        <div className="bk3d" ref={ref} />
      </div>
    </div>
  );
}
