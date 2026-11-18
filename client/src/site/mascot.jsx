/*
 * Маскот школи — розгорнутий підручник, як на заставці входу: чисті кремові сторінки, палітурка в кольорі бренду,
 * ручки й ніжки — прості лінії, очі — чорні крапки, рот — проста усмішка.
 * Анімації (кліпає, махає ручкою, дихає, на бігу перебирає ніжками) — у site.css (.s-mascot).
 */
const INK = '#1d1733';

export function Book() {
  return (
    <svg className="s-mascot-svg" viewBox="0 0 120 112" aria-hidden="true">
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
      <ellipse className="s-mascot-ground" cx="60" cy="108" rx="30" ry="3.5" />
      {/* ніжки */}
      <g className="s-mascot-foot is-l"><path d="M50 82 L47 104 L40 104" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="s-mascot-foot is-r"><path d="M70 82 L73 104 L80 104" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className="s-mascot-body">
        {/* ліва ручка */}
        <path d="M8 48 L-3 63" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
        {/* палітурка */}
        <path className="s-mascot-cover" d="M60 35 Q35 24 5 28 L5 79 Q35 75 60 86 Q85 75 115 79 L115 28 Q85 24 60 35 Z" />
        {/* зріз сторінок під кожною половиною */}
        <path d="M60 33 Q36 22 9 26 L9 76 Q36 72 60 82 Q84 72 111 76 L111 26 Q84 22 60 33 Z" fill="#e6dccd" />
        {/* розгорнуті сторінки, чисті */}
        <path d="M60 30 Q37 19 10 23 L10 72 Q37 68 60 79 Z" fill="url(#bk-left)" />
        <path d="M60 30 Q83 19 110 23 L110 72 Q83 68 60 79 Z" fill="url(#bk-right)" />
        <path d="M60 30 V79" stroke="#cfc3b2" strokeWidth="1.2" />
        {/* обличчя */}
        <g className="s-mascot-eyes">
          <circle cx="47" cy="47" r="3.8" fill={INK} />
          <circle cx="73" cy="47" r="3.8" fill={INK} />
        </g>
        <circle cx="38" cy="56" r="3.6" fill="#ff8fa3" opacity="0.6" />
        <circle cx="82" cy="56" r="3.6" fill="#ff8fa3" opacity="0.6" />
        <path d="M52 56 Q60 63.5 68 56" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      </g>
      {/* права ручка — махає */}
      <g className="s-mascot-arm"><path d="M112 48 L123 33" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" /></g>
    </svg>
  );
}
