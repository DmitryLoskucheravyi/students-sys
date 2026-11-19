/*
 * Ілюстрації карток курсів: 1 головний об'єкт + маскот + не більше 2 дрібних деталей.
 * У кожної дві сцени, а не одна масштабована:
 *   .is-d — комп'ютер (≥1200): повна сцена; деталь .cc-d2 — лише тут;
 *   .is-m — телефон і планшет: об'єкт + маскот; деталь .cc-t — лише на планшеті (≥768).
 * play — лічильник запусків «мікродії» (course-card.css: .is-play). Сцена в спокої — це кадр «до» або «після» дії,
 * тож без JavaScript і з «менше руху» все одно видно цілу картинку.
 * Уся ілюстрація — aria-hidden (див. CourseCard).
 */
import { useEffect, useState } from 'react';
import { prefersCalm } from './motion.jsx';

/* ───────── Маскот: помаранчева книжка ───────── */

/** Обличчя на обкладинці (координати 52×70). happy — для молодших (рум'янець), calm — напівусмішка, cool — окуляри. */
function Face({ face }) {
  if (face === 'cool') {
    return (
      <>
        <rect x="12" y="23" width="36" height="11" rx="5.5" fill="#1d1733" />
        <rect x="15" y="25.5" width="12" height="3" rx="1.5" fill="#8f7cff" /><rect x="33" y="25.5" width="12" height="3" rx="1.5" fill="#8f7cff" />
        <path d="M24 43 Q31 46 37 42" fill="none" stroke="#1d1733" strokeWidth="2.4" strokeLinecap="round" />
      </>
    );
  }
  if (face === 'calm') {
    return (
      <>
        <path d="M18 29 Q23 25 28 29" fill="none" stroke="#1d1733" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M34 29 Q39 25 44 29" fill="none" stroke="#1d1733" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M25 41 Q31 45 37 40" fill="none" stroke="#1d1733" strokeWidth="2.4" strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <ellipse cx="22" cy="26" rx="6" ry="7" fill="#fff" /><ellipse cx="38" cy="26" rx="6" ry="7" fill="#fff" />
      <circle cx="23" cy="27" r="3.2" fill="#1d1733" /><circle cx="39" cy="27" r="3.2" fill="#1d1733" />
      <circle cx="24.4" cy="25.4" r="1.1" fill="#fff" /><circle cx="40.4" cy="25.4" r="1.1" fill="#fff" />
      <circle cx="15" cy="38" r="3.6" fill="#ff8fa3" opacity="0.75" /><circle cx="45" cy="38" r="3.6" fill="#ff8fa3" opacity="0.75" />
      <path d="M23 39 Q30 50 37 39 Z" fill="#1d1733" />
    </>
  );
}

/** Книжка: блок сторінок і помаранчева обкладинка з обличчям. Розмір — --book (88 / 72 / 56). Повільно «дихає». */
export function Book({ face = 'happy', className = '' }) {
  return (
    <span className={`cc-book ${className}`}>
      <span className="lb">
        <i className="lb-block" />
        <i className="lb-page" />
        <span className="lb-cover"><i className="lb-cover-f"><svg viewBox="0 0 52 70"><Face face={face} /></svg></i></span>
      </span>
    </span>
  );
}

/** Текст, що «друкується» по літері під час мікродії. Поза нею — увесь текст (місце під нього зарезервоване). */
export function useTyped(text, play, { speed = 55, delay = 0 } = {}) {
  const [n, setN] = useState(text.length);
  useEffect(() => {
    if (!play || prefersCalm()) { setN(text.length); return undefined; }
    setN(0);
    let k = 0;
    let tick = 0;
    const start = setTimeout(() => {
      tick = setInterval(() => { k += 1; setN(k); if (k >= text.length) clearInterval(tick); }, speed);
    }, delay);
    return () => { clearTimeout(start); clearInterval(tick); };
  }, [play, text, speed, delay]);
  return n;
}

function Typed({ text, n, caret = true }) {
  return (
    <span className="cc-typed">
      {text.slice(0, n)}
      {caret && n < text.length && <i className="cc-caret" />}
      <span className="cc-ghost">{text.slice(n)}</span>
    </span>
  );
}

const Bar = ({ label, children }) => <span className="cc-bar"><i /><i /><i />{label && <span>{label}</span>}{children}</span>;

/* ───────── 1. Комп'ютерна грамотність: монітор + клавіатура, книжка на клавіатурі ───────── */

const PC_TEXT = 'Я вмію друкувати!';
const KEYS = 33;
const keyFor = (ch) => (ch && ch !== ' ' ? (ch.charCodeAt(0) * 7) % KEYS : -1);

function Kb({ lit }) {
  return (
    <span className="pc-kb">
      {Array.from({ length: KEYS }, (_, k) => <i key={k} className={k === lit ? 'is-lit' : ''} />)}
      <b className={lit === -2 ? 'is-lit' : ''} />
    </span>
  );
}

function Monitor({ n }) {
  return (
    <span className="pc-mon">
      <span className="pc-screen">
        <span className="pc-win"><Bar label="Привіт.txt" /><b><Typed text={PC_TEXT} n={n} /></b></span>
      </span>
      <span className="pc-stand" />
    </span>
  );
}

function PcArt({ play }) {
  const n = useTyped(PC_TEXT, play, { speed: 90 });
  const typing = n < PC_TEXT.length;
  const ch = PC_TEXT[n - 1];
  const lit = !typing || n === 0 ? null : ch === ' ' ? -2 : keyFor(ch.toLowerCase());
  return (
    <>
      <div className="cc-scene is-d" key={`d${play}`}>
        <Monitor n={n} />
        <Kb lit={lit} />
        <Book face="happy" className="pc-book" />
        <span className="pc-key cc-d2">Enter</span>
      </div>
      <div className="cc-scene is-m" key={`m${play}`}>
        <Monitor n={n} />
        <span className="cc-t"><Kb lit={lit} /></span>
        <Book face="happy" className="pc-book" />
      </div>
    </>
  );
}

/* ───────── 2. Scratch: стек блоків → книжка стрибає по дузі ───────── */

const Hop = () => (
  <span className="sc-hop">
    <span className="sc-hop-x"><span className="sc-hop-y"><Book face="happy" /></span></span>
  </span>
);

function Stage() {
  return (
    <span className="sc-stage">
      <span className="sc-stage-bar"><i className="sc-flag" /><i className="sc-stop" /></span>
      <span className="sc-scene">
        <svg className="sc-arc" viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M6 38 Q50 -16 94 38" /></svg>
        <Hop />
      </span>
    </span>
  );
}

function ScratchArt({ play }) {
  return (
    <>
      <div className="cc-scene is-d" key={`d${play}`}>
        <span className="sc-stack">
          <span className="sc-b is-event">коли натиснуто <i className="sc-flag" /></span>
          <span className="sc-loop">
            <span className="sc-b is-ctrl">повторити <em>3</em> рази</span>
            <span className="sc-slot"><span className="sc-b is-motion sc-snap">стрибнути!</span></span>
            <span className="sc-loop-end" />
          </span>
        </span>
        <Stage />
      </div>
      <div className="cc-scene is-m" key={`m${play}`}>
        <span className="sc-stack"><span className="sc-b is-motion sc-snap">стрибнути!</span></span>
        <Stage />
        <span className="cc-t"><span className="sc-say">Ура!</span></span>
      </div>
    </>
  );
}

/* ───────── 3. ШІ: промпт → картинка проявляється з розмиття ───────── */

const AI_TEXT = 'Нічні гори, мультяшний стиль';

function Night() {
  return (
    <svg viewBox="0 0 240 170" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="cc-ai-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2a1f73" /><stop offset="1" stopColor="#7a5ae0" /></linearGradient></defs>
      <rect width="240" height="170" fill="url(#cc-ai-sky)" />
      {[[30, 26], [72, 58], [204, 96], [118, 30], [44, 92], [186, 18], [150, 64]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" fill="#fff" />)}
      <circle cx="176" cy="52" r="22" fill="#f8eed6" /><circle cx="169" cy="47" r="4.5" fill="#e6d7b6" /><circle cx="183" cy="60" r="3" fill="#e6d7b6" />
      <path d="M0 130 L58 78 L100 118 L148 72 L240 132 V170 H0 Z" fill="#3b2a9c" />
      <path d="M58 78 L70 89 L62 92 L52 84 Z M148 72 L162 81 L150 86 L140 80 Z" fill="#e9e4ff" opacity="0.9" />
      <path d="M0 150 L46 122 L96 156 L152 116 L204 146 L240 130 V170 H0 Z" fill="#1d1733" />
    </svg>
  );
}

const Spark = ({ className }) => (
  <svg className={`ai-spark ${className}`} viewBox="0 0 24 24"><path d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z" /></svg>
);

function Prompt({ n }) {
  return (
    <span className="ai-prompt">
      <small>Промпт</small>
      <b><Typed text={AI_TEXT} n={n} /></b>
      <span className="ai-send"><svg viewBox="0 0 24 24"><path d="M12 19V5m-6 6 6-6 6 6" /></svg></span>
    </span>
  );
}

function AiArt({ play }) {
  const n = useTyped(AI_TEXT, play, { speed: 40 });
  return (
    <>
      <div className="cc-scene is-d" key={`d${play}`}>
        <Prompt n={n} />
        <span className="ai-pic"><Night /><span className="ai-chip">✦ Згенеровано</span></span>
        <Book face="happy" className="ai-book" />
        <Spark className="is-a cc-d2" />
        <Spark className="is-b cc-d2" />
      </div>
      <div className="cc-scene is-m" key={`m${play}`}>
        <Prompt n={n} />
        <span className="ai-pic"><Night /><span className="cc-t"><span className="ai-chip">✦ Згенеровано</span></span></span>
        <Book face="happy" className="ai-book" />
      </div>
    </>
  );
}

/* ───────── 4. Python: змійка + термінал, книжка сидить на терміналі ───────── */

const SNAKE_BODY = 'M58 236 C 26 230, 32 196, 92 192 C 152 188, 212 196, 208 218 C 204 242, 140 248, 100 241 C 62 234, 70 210, 120 206 C 170 202, 190 186, 180 158 C 170 130, 126 122, 140 86';
const SNAKE_NECK = 'M120 206 C 170 202, 190 186, 180 158 C 170 130, 126 122, 140 86';

/** Змійка дивиться ліворуч — на книжку. Під час мікродії киває головою. */
function Snake() {
  const body = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg className="py-snake" viewBox="0 0 240 260">
      <defs>
        <linearGradient id="cc-sn-body" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#5aa7ec" /><stop offset="1" stopColor="#2f6db3" /></linearGradient>
        <radialGradient id="cc-sn-head" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stopColor="#6fb6f2" /><stop offset="1" stopColor="#2f6db3" /></radialGradient>
      </defs>
      <ellipse cx="122" cy="248" rx="92" ry="9" fill="#000" opacity="0.22" />
      <path d={SNAKE_BODY} stroke="#24558f" strokeWidth="34" {...body} />
      <path d={SNAKE_BODY} stroke="url(#cc-sn-body)" strokeWidth="30" {...body} />
      <path d={SNAKE_BODY} stroke="#2a5e9c" strokeWidth="30" strokeDasharray="4 16" opacity="0.4" {...body} />
      <path d={SNAKE_NECK} stroke="#ffe27a" strokeWidth="9" opacity="0.9" {...body} />
      <g className="py-head">
        <ellipse cx="142" cy="62" rx="38" ry="31" fill="url(#cc-sn-head)" />
        <circle cx="128" cy="57" r="10" fill="#fff" /><circle cx="157" cy="57" r="10" fill="#fff" />
        <circle cx="125" cy="59" r="5.6" fill="#1d1733" /><circle cx="154" cy="59" r="5.6" fill="#1d1733" />
        <circle cx="127" cy="56" r="2" fill="#fff" /><circle cx="156" cy="56" r="2" fill="#fff" />
        <path d="M133 74 Q142 80 151 74" stroke="#1d1733" strokeWidth="2.6" {...body} />
      </g>
    </svg>
  );
}

const PY_CMD = 'курс.старт()';

function Term({ n, answer, more }) {
  const done = n >= PY_CMD.length;
  return (
    <span className="py-term">
      <Bar label="python3" />
      <code>
        <span><u>{'>>>'}</u> <Typed text={PY_CMD} n={n} /></span>
        {answer && <span className={`py-out ${done ? '' : 'is-wait'}`}>'Привіт, Python!'</span>}
        {more}
      </code>
    </span>
  );
}

function PythonArt({ play }) {
  const n = useTyped(PY_CMD, play, { speed: 80 });
  return (
    <>
      <div className="cc-scene is-d" key={`d${play}`}>
        <Term n={n} answer more={<span className="cc-d2"><u>{'>>>'}</u> <i className="cc-caret is-blink" /></span>} />
        <Book face="calm" className="py-book" />
        <Snake />
      </div>
      <div className="cc-scene is-m" key={`m${play}`}>
        <Term n={n} answer={false} more={<span className="cc-t py-out">'Привіт, Python!'</span>} />
        <Book face="calm" className="py-book" />
        <Snake />
      </div>
    </>
  );
}

/* ───────── 5. Frontend: код → сайт у браузері, книжка визирає з браузера ───────── */

function Editor({ short }) {
  return (
    <span className="fe-code">
      <Bar label="index.html" />
      <code>
        {!short && <span><u className="t">{'<h1>'}</u>Привіт!<u className="t">{'</h1>'}</u></span>}
        {!short && <span><u className="t">{'<button>'}</u>Старт<u className="t">{'</button>'}</u></span>}
        {!short && <span> </span>}
        <span><u className="a">h1</u> {'{'}</span>
        <span>{'  '}color: <span className="fe-swap"><u className="n is-old">#2D2A6E</u><u className="n is-new">#E8541E</u></span>;</span>
        <span>{'}'}</span>
      </code>
    </span>
  );
}

function Browser() {
  return (
    <span className="fe-web">
      <Bar><span className="fe-url"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>мій-сайт.com</span></Bar>
      <span className="fe-page"><b>Привіт!</b><i /><i className="is-short" /><span>Старт</span></span>
    </span>
  );
}

const Pointer = ({ className = '' }) => <svg className={`cc-pointer ${className}`} viewBox="0 0 24 24"><path d="M5 3l14 8-6 2-3 6z" /></svg>;

function FrontendArt({ play }) {
  return (
    <>
      <div className="cc-scene is-d" key={`d${play}`}>
        <Editor />
        <Book face="calm" className="fe-book" />
        <Browser />
        <Pointer className="fe-pointer cc-d2" />
      </div>
      <div className="cc-scene is-m" key={`m${play}`}>
        <Editor short />
        <Book face="calm" className="fe-book" />
        <Browser />
        <span className="cc-t"><Pointer className="fe-pointer" /></span>
      </div>
    </>
  );
}

/* ───────── 6. Backend: клієнт → api-server → база, книжка сидить на базі ───────── */

const Check = () => <span className="be-check cc-d2"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>;
const Status = () => <code className="be-status"><u>GET</u> /students <b>200</b></code>;

/** status: true — рядок запиту завжди; 'tablet' — лише на планшеті (на телефоні сцена найпростіша). */
function Server({ status = true }) {
  return (
    <span className="be-api">
      <span className="be-api-head"><span>api-server</span><em>● online</em></span>
      <i /><i />
      {status === 'tablet' ? <span className="cc-t"><Status /></span> : status && <Status />}
    </span>
  );
}

const Db = () => <span className="be-db"><span>students</span></span>;

function BackendArt({ play }) {
  return (
    <>
      <div className="cc-scene is-d" key={`d${play}`}>
        <span className="be-client"><Bar /><b>Клієнт</b><i /><i /><Check /></span>
        <span className="be-wire is-1"><i className="be-dot" /></span>
        <Server />
        <span className="be-wire is-2"><i className="be-dot" /></span>
        <Db />
        <Book face="calm" className="be-book" />
      </div>
      <div className="cc-scene is-m" key={`m${play}`}>
        <Server status="tablet" />
        <span className="be-wire is-v"><i className="be-dot" /></span>
        <Db />
        <Book face="calm" className="be-book" />
      </div>
    </>
  );
}

/* ───────── 7. Frontend PRO: редактор + компонент, книжка в окулярах на куті редактора ───────── */

const StepNum = () => <span className="pro-swap"><u className="n is-old">1</u><u className="n is-new">2</u></span>;

function ProArt({ play }) {
  return (
    <>
      <div className="cc-scene is-d" key={`d${play}`}>
        <span className="pro-glow" />
        <span className="pro-code">
          <Bar><span className="is-on">page.tsx</span><span>Course.tsx</span></Bar>
          <code>
            <span className="c">{'// app/page.tsx'}</span>
            <span><u className="k">const</u> [step, setStep] = <u className="f">useState</u>(<u className="n">1</u>);</span>
            <span><u className="f">setStep</u>(<StepNum />);</span>
            <span><u className="k">return</u> <u className="t">{'<Course'}</u> <u className="a">step</u>={'{'}step{'}'} <u className="t">{'/>'}</u>;</span>
          </code>
        </span>
        <span className="pro-comp"><b>{'<Course />'}</b><em>PRO</em></span>
        <Book face="cool" className="pro-book" />
        <span className="pro-ok cc-d2">✓ Compiled</span>
      </div>
      <div className="cc-scene is-m" key={`m${play}`}>
        <span className="pro-glow" />
        <span className="pro-code">
          <Bar><span className="is-on">page.tsx</span></Bar>
          <code>
            <span><u className="f">setStep</u>(<StepNum />);</span>
            <span><u className="k">return</u> <u className="t">{'<Course />'}</u>;</span>
          </code>
        </span>
        <span className="cc-t"><span className="pro-comp"><b>{'<Course />'}</b><em>PRO</em></span></span>
        <Book face="cool" className="pro-book" />
      </div>
    </>
  );
}

export const COURSE_ART = { pc: PcArt, scratch: ScratchArt, ai: AiArt, python: PythonArt, frontend: FrontendArt, backend: BackendArt, pro: ProArt };
