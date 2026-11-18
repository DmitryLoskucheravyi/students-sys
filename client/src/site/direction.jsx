/*
 * Картка напрямку на сайті (як у макеті): ліворуч назва з акцентом, опис, шлях-чипи й дві кнопки,
 * праворуч ілюстрація — вікно з кодом, віконце «Привіт!» і книжка-маскот, що визирає з кутка.
 * Слайдер: на всю ширину, по одній картці, стрілки — помаранчеві «таблетки», як у заголовку хіро.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLead } from './ctx.js';
import { prefersCalm } from './motion.jsx';
import { directionPath } from './seo.js';

const Arrow = ({ left }) => (
  <svg viewBox="0 0 48 24" aria-hidden="true"><path d={left ? 'M40 12H12m9-8-9 8 9 8' : 'M8 12h28m-9-8 9 8-9 8'} /></svg>
);

/** Обличчя на обкладинці (координати 52×70 — розмір обкладинки). */
function CoverFace({ face }) {
  if (face === 'cool') {
    return (
      <>
        <rect x="13" y="23" width="34" height="11" rx="5.5" fill="#1d1733" />
        <rect x="16" y="25.5" width="11" height="3" rx="1.5" fill="#6d5ae0" />
        <rect x="33" y="25.5" width="11" height="3" rx="1.5" fill="#6d5ae0" />
        <path d="M24 43 Q30 47 36 43" fill="none" stroke="#1d1733" strokeWidth="2.4" strokeLinecap="round" />
      </>
    );
  }
  if (face === 'happy') {
    return (
      <>
        <ellipse cx="22" cy="26" rx="6" ry="7" fill="#fff" /><ellipse cx="38" cy="26" rx="6" ry="7" fill="#fff" />
        <circle cx="23" cy="27" r="3.2" fill="#1d1733" /><circle cx="39" cy="27" r="3.2" fill="#1d1733" />
        <path d="M22 40 Q30 52 38 40 Z" fill="#1d1733" />
      </>
    );
  }
  return (
    <>
      <circle cx="24" cy="30" r="3.6" fill="#1d1733" /><circle cx="40" cy="30" r="3.6" fill="#1d1733" />
      <circle cx="19" cy="39" r="3.2" fill="#ff8fa3" opacity="0.65" /><circle cx="45" cy="39" r="3.2" fill="#ff8fa3" opacity="0.65" />
      <path d="M26 38 Q32 44 38 38" fill="none" stroke="#1d1733" strokeWidth="2.4" strokeLinecap="round" />
    </>
  );
}

/**
 * Книжка-маскот у кутку картки, як на заставці входу: обкладинка в 3D повертається навколо корінця,
 * сторінка перегортається туди й назад, книжка закривається. Кожна — у своєму темпі й зі своїм зсувом,
 * щоб не рухались синхронно. face: 'smile' | 'cool' | 'happy'.
 */
function LoopBook({ face = 'smile', className = '' }) {
  const [pace] = useState(() => ({ '--lb-t': `${(6.5 + Math.random() * 2.5).toFixed(2)}s`, '--lb-d': `${(-Math.random() * 8).toFixed(2)}s` }));
  return (
    <span className={`s-dir-book lb ${className}`} style={pace} aria-hidden="true">
      <i className="lb-block" />
      <i className="lb-page" />
      <span className="lb-flip"><i className="lb-face-f" /><i className="lb-face-b" /></span>
      <span className="lb-cover">
        <i className="lb-cover-f"><svg viewBox="0 0 52 70"><CoverFace face={face} /></svg></i>
        <i className="lb-cover-b" />
      </span>
    </span>
  );
}

const PeekBook = () => <LoopBook />;

/** Ілюстрація напрямку «Frontend»: перша сторінка учня й код, з якого вона зроблена. */
function FrontendArt() {
  return (
    <div className="s-dir-art" aria-hidden="true">
      <div className="s-dir-code">
        <div className="s-dir-code-bar"><i /><i /><i /><span>index.html</span></div>
        <code>
          <span className="c">{'<!-- мій перший сайт -->'}</span>
          <span><u className="t">{'<h1 '}</u><u className="a">class</u>=<u className="s">"title"</u><u className="t">{'>'}</u>Привіт!<u className="t">{'</h1>'}</u></span>
          <span><u className="t">{'<button '}</u><u className="a">id</u>=<u className="s">"go"</u><u className="t">{'>'}</u>Старт<u className="t">{'</button>'}</u></span>
          <span> </span>
          <span><u className="a">.title</u> {'{'} color: <u className="n">#ff813e</u>; {'}'}</span>
          <span>go.<u className="f">onclick</u> = () {'=>'} <u className="f">launch</u>();</span>
        </code>
      </div>
      <div className="s-dir-page">
        <b>Привіт!</b>
        <i />
        <span>Старт</span>
      </div>
      <PeekBook />
    </div>
  );
}

/** Книжка в темних окулярах для «Frontend PRO». */
const CoolBook = () => <LoopBook face="cool" className="is-cool" />;

/** Ілюстрація «Frontend PRO»: теги технологій, вікно з React/TypeScript-кодом і готовий компонент. */
function ProArt() {
  return (
    <div className="s-dir-art is-pro" aria-hidden="true">
      <span className="s-dir-tag is-react">React</span>
      <span className="s-dir-tag is-ts">TypeScript</span>
      <span className="s-dir-tag is-next">Next.js</span>
      <div className="s-dir-code">
        <div className="s-dir-code-bar"><i /><i /><i /><span className="is-on">page.tsx</span><span>Course.tsx</span></div>
        <code>
          <span className="c">{'// app/page.tsx'}</span>
          <span><u className="k">const</u> [step, setStep] = <u className="f">useState</u>(<u className="n">1</u>);</span>
          <span><u className="k">return</u> <u className="t">{'<Course'}</u> <u className="a">level</u>=<u className="s">"pro"</u> <u className="t">{'/>'}</u>;</span>
        </code>
      </div>
      <div className="s-dir-comp">
        <b>{'<Course />'}<em>PRO</em></b>
      </div>
      <CoolBook />
    </div>
  );
}

/** Спрощений знак Python: дві половинки, синя й жовта. */
function PyMark() {
  return (
    <svg className="s-dir-pylogo" viewBox="0 0 64 64" aria-hidden="true" overflow="visible">
      <path d="M31 4c-12 0-12 5-12 9v6h13v3H13c-6 0-9 5-9 12s3 12 9 12h5v-7c0-5 4-9 9-9h12c4 0 7-3 7-7V13c0-4-4-9-15-9Z" fill="#3c78aa" />
      <path d="M33 60c12 0 12-5 12-9v-6H32v-3h19c6 0 9-5 9-12s-3-12-9-12h-5v7c0 5-4 9-9 9H25c-4 0-7 3-7 7v10c0 4 4 9 15 9Z" fill="#ffd43b" />
      <circle cx="25" cy="11" r="2.6" fill="#fff" />
      <circle cx="39" cy="53" r="2.6" fill="#fff" />
    </svg>
  );
}

/**
 * Змійка-маскот: одне суцільне тіло — кільце знизу плавно переходить у шию, без стиків.
 * Голова похитується, очі дивляться по сторонах, язик висувається (site.css: .sn-*).
 */
const SNAKE_BODY = 'M58 236 C 26 230, 32 196, 92 192 C 152 188, 212 196, 208 218 C 204 242, 140 248, 100 241 C 62 234, 70 210, 120 206 C 170 202, 190 186, 180 158 C 170 130, 126 122, 140 86';
const SNAKE_NECK = 'M120 206 C 170 202, 190 186, 180 158 C 170 130, 126 122, 140 86';

function Snake() {
  const body = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg className="s-dir-snake" viewBox="0 0 240 260" aria-hidden="true">
      <defs>
        <linearGradient id="sn-body" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#5aa7ec" /><stop offset="1" stopColor="#2f6db3" /></linearGradient>
        <radialGradient id="sn-head" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stopColor="#6fb6f2" /><stop offset="1" stopColor="#2f6db3" /></radialGradient>
      </defs>
      <ellipse cx="122" cy="248" rx="92" ry="9" fill="#000" opacity="0.22" />
      <g className="sn-body">
        {/* тіло одним штрихом: тінь-обвідка, заливка, смуги, світлий відблиск зверху */}
        <path d={SNAKE_BODY} stroke="#24558f" strokeWidth="34" {...body} />
        <path d={SNAKE_BODY} stroke="url(#sn-body)" strokeWidth="30" {...body} />
        <path d={SNAKE_BODY} stroke="#2a5e9c" strokeWidth="30" strokeDasharray="4 16" opacity="0.4" {...body} />
        <path d={SNAKE_BODY} stroke="#ffffff" strokeWidth="5" opacity="0.18" transform="translate(-4 -6)" {...body} />
        {/* жовте черевце на шиї */}
        <path d={SNAKE_NECK} stroke="#ffe27a" strokeWidth="9" opacity="0.9" {...body} />
      </g>
      <g className="sn-head">
        <ellipse cx="142" cy="62" rx="38" ry="31" fill="url(#sn-head)" />
        <ellipse cx="128" cy="46" rx="13" ry="6" fill="#fff" opacity="0.28" transform="rotate(-20 128 46)" />
        <circle cx="128" cy="57" r="10" fill="#fff" /><circle cx="157" cy="57" r="10" fill="#fff" />
        <g className="sn-eyes">
          <circle cx="130" cy="59" r="5.6" fill="#1d1733" /><circle cx="159" cy="59" r="5.6" fill="#1d1733" />
          <circle cx="132" cy="56" r="2" fill="#fff" /><circle cx="161" cy="56" r="2" fill="#fff" />
        </g>
        <circle cx="119" cy="72" r="4.6" fill="#ff8fa3" opacity="0.7" /><circle cx="168" cy="72" r="4.6" fill="#ff8fa3" opacity="0.7" />
        <path d="M135 73 Q144 80 153 73" stroke="#1d1733" strokeWidth="2.6" {...body} />
        <path className="sn-tongue" d="M144 78 L144 92 M144 92 L139 98 M144 92 L149 98" stroke="#ff5f57" strokeWidth="2.6" {...body} />
      </g>
    </svg>
  );
}

/** Ілюстрація «Python з нуля»: змійка-маскот, знак Python і термінал з першим запуском. */
function PythonArt() {
  return (
    <div className="s-dir-art is-py" aria-hidden="true">
      <PyMark />
      <Snake />
      <div className="s-dir-term">
        <div className="s-dir-code-bar"><i /><i /><i /><span>python3</span></div>
        <code>
          <span><u className="p">{'>>>'}</u> <u className="k">import</u> курс</span>
          <span><u className="p">{'>>>'}</u> курс.<u className="f">старт</u>()</span>
          <span className="s">'Привіт, Python!'</span>
          <span><u className="p">{'>>>'}</u> <i className="s-dir-caret" /></span>
        </code>
      </div>
    </div>
  );
}

/** Рядки Python-коду на тлі картки (декор). */
const PY_BG = [
  '>>> import this    def main():    for x in range(10):    if __name__ == "__main__":    print()    while True:',
  'return    class Game:    >>> len(курс)    import random    lambda x: x * 2    elif:    try: ... except:',
  '>>> def hello(name):    pass    yield    with open("main.py") as f:    import turtle    break',
  'for i in range(3):    >>> type(42)    list()    dict()    True    None    print(f"{x}")    if',
  'import math    "py" * 3    def score():    return x    while lives > 0:    else:    >>> help()',
  'score += 100    import time    for char in name:    print("OK")    import json    is not None',
  'return True    >>> max(a, b)    from random import randint    def move(dx):    except ValueError:',
];

/** Книжка з великими очима. */
const HappyBook = () => <LoopBook face="happy" className="is-happy" />;

/** Ілюстрація «Backend»: клієнт → сервер API, клас Student, база students і SQL-запит. */
function BackendArt() {
  return (
    <div className="s-dir-art is-be" aria-hidden="true">
      <div className="s-be-top">
      <span className="s-be-status">{'{ "status": 200 }'}</span>
      <div className="s-be-client"><div className="s-dir-code-bar"><i /><i /><i /></div><b>Клієнт</b><i /><i /></div>
      <span className="s-be-arrow" />
      <div className="s-be-api">
        <p><span>api-server</span><em>● online</em></p>
        <i /><i />
        <code><u>GET</u> /students <b>200</b> <u className="is-post">POST</u> /lessons</code>
      </div>
      </div>
      {/* на телефоні й планшеті — фоном картки */}
      <div className="s-be-rest">
      <div className="s-be-class">
        <b>class Student</b>
        <p><span><em>-</em> name</span><span><em>-</em> level</span></p>
        <p><span><em className="is-pub">+</em> enroll()</span><span><em className="is-pub">+</em> getProgress()</span></p>
      </div>
      <span className="s-be-down" />
      <div className="s-be-db"><span>students</span></div>
      <code className="s-be-sql"><u>SELECT</u> name <u>FROM</u> students{'\n'}<u>WHERE</u> level = <b>'pro'</b>;</code>
      </div>
      <HappyBook />
    </div>
  );
}

const Spark = ({ className }) => (
  <svg className={`s-ai-spark ${className}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z" /></svg>
);

/** Ілюстрація «ШІ з нуля»: промпт, згенерована картинка, відео з тексту, зірочки й книжка. */
function AiArt() {
  return (
    <div className="s-dir-art is-ai" aria-hidden="true">
      <div className="s-ai-prompt">
        <small>Промпт</small>
        <p>Нічне небо над горами, мультяшний стиль<i className="s-dir-caret" /></p>
        <span className="s-ai-send"><svg viewBox="0 0 24 24"><path d="M12 19V5m-6 6 6-6 6 6" /></svg></span>
      </div>
      {/* на телефоні й планшеті — фоном картки */}
      <div className="s-ai-bg">
      <div className="s-ai-pic">
        <span className="s-ai-chip">✦ Згенеровано</span>
        <svg viewBox="0 0 240 230" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="ai-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2a1f73" /><stop offset="1" stopColor="#6d5ae0" /></linearGradient>
          </defs>
          <rect width="240" height="230" fill="url(#ai-sky)" />
          {[[30, 30], [70, 80], [200, 120], [120, 40], [40, 120], [180, 20]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="#fff" />)}
          <circle cx="170" cy="70" r="26" fill="#f5ead2" /><circle cx="162" cy="64" r="5" fill="#e3d4b4" /><circle cx="178" cy="80" r="3.5" fill="#e3d4b4" />
          <ellipse cx="52" cy="112" rx="12" ry="3" fill="none" stroke="#ff9a55" strokeWidth="2" /><circle cx="52" cy="112" r="6" fill="#ff9a55" />
          <path d="M0 175 L60 115 L105 160 L150 110 L240 175 V230 H0 Z" fill="#3a2a9a" />
          <path d="M0 200 L45 165 L95 205 L150 155 L200 190 L240 170 V230 H0 Z" fill="#1d1733" />
        </svg>
      </div>
      <div className="s-ai-video">
        <div className="s-ai-frame"><span className="s-ai-play"><svg viewBox="0 0 24 24"><path d="M9 7v10l8-5z" /></svg></span></div>
        <p><i><b /></i><span>0:04 / 0:08</span></p>
      </div>
      <Spark className="is-a" /><Spark className="is-b" /><Spark className="is-c" /><Spark className="is-d" />
      </div>
      <HappyBook />
    </div>
  );
}

/** Ілюстрація «Комп'ютерна грамотність»: монітор із робочим столом, клавіатура, мишка, книжка. */
const KEYS = 33;
/** Клавіатура, на якій по черзі підсвічуються різні клавіші — ніби хтось друкує. */
function useTyping() {
  const [lit, setLit] = useState(() => new Set([3, 13, 26]));
  useEffect(() => {
    if (prefersCalm()) return undefined;
    const t = setInterval(() => {
      const next = new Set();
      while (next.size < 3) next.add(Math.floor(Math.random() * KEYS));
      setLit(next);
    }, 650);
    return () => clearInterval(t);
  }, []);
  return lit;
}

function PcArt() {
  const lit = useTyping();
  return (
    <div className="s-dir-art is-pc" aria-hidden="true">
      <div className="s-pc-screen">
        <div className="s-pc-desk">
          <span className="s-pc-ico is-folder"><i />Ігри</span>
          <span className="s-pc-ico is-file"><i />Мій файл</span>
          <span className="s-pc-ico is-paint"><i />Малюнок</span>
          <div className="s-pc-win"><p><b>Привіт.txt</b><i /><i /></p><span>Я вмію друкувати!<em /></span></div>
          <svg className="s-pc-cursor" viewBox="0 0 24 24"><path d="M5 3l14 8-6 2-3 6z" /></svg>
          <div className="s-pc-bar"><i /><i /><i /><span>10:00</span></div>
        </div>
      </div>
      <span className="s-pc-stand" />
      {/* на телефоні й планшеті — фоном картки */}
      <div className="s-pc-bg">
      <div className="s-pc-kb">
        {Array.from({ length: KEYS }, (_, k) => <i key={k} className={lit.has(k) ? 'is-lit' : ''} />)}
        <b /><b className="is-space" /><b className="is-dark" />
      </div>
      <span className="s-pc-mouse" />
      <HappyBook />
      </div>
    </div>
  );
}

/** Ілюстрація «Програмуємо граючись»: стос кольорових блоків-команд і сцена, де книжка стрибає й вітається. */
function ScratchArt() {
  return (
    <div className="s-dir-art is-scratch" aria-hidden="true">
      <div className="s-sc-stack">
        <span className="s-sc-b is-event">коли натиснуто <i className="s-sc-flag" /></span>
        <div className="s-sc-loop">
          <span className="s-sc-b is-ctrl">повторити <em>10</em> разів</span>
          <span className="s-sc-b is-motion">перемістити на <em>10</em> кроків</span>
          <span className="s-sc-b is-looks">сказати <em>Привіт!</em></span>
          <span className="s-sc-loop-end" />
        </div>
        <span className="s-sc-b is-sound">грати звук <em>бум</em></span>
      </div>
      <span className="s-sc-b is-event s-sc-drag">стрибнути!</span>
      <svg className="s-sc-cursor" viewBox="0 0 24 24"><path d="M5 3l14 8-6 2-3 6z" /></svg>
      <div className="s-sc-stage">
        <p><i className="s-sc-flag" /><i className="s-sc-stop" /><span>Сцена</span></p>
        <div className="s-sc-scene">
          <i className="s-sc-cloud" /><i className="s-sc-cloud is-2" />
          <svg className="s-sc-arc" viewBox="0 0 100 50"><path d="M4 46 Q30 -10 70 30" /></svg>
          <span className="s-sc-hero"><LoopBook face="happy" className="is-actor is-still" /></span>
          <span className="s-sc-say">Привіт!</span>
        </div>
      </div>
    </div>
  );
}

const FEAT_ICON = {
  blocks: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="11" height="6" rx="1.5" /><rect x="7" y="14" width="14" height="6" rx="1.5" /><path d="M8 10v4" /></svg>,
  gamepad: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="7" width="19" height="11" rx="5" /><path d="M7 10.5v4M5 12.5h4M15.5 12h.01M18 14h.01" /></svg>,
  film: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4l2 5M14 4l2 5M10 13v4l4-2z" /></svg>,
  keyboard: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" /></svg>,
  folder: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>,
  shield: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" /><path d="m9 12 2 2 4-4" /></svg>,
  idea: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3Z" /></svg>,
  image: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></svg>,
  video: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></svg>,
  server: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="7" rx="2" /><rect x="4" y="13" width="16" height="7" rx="2" /><path d="M8 7.5h.01M8 16.5h.01" /></svg>,
  db: <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></svg>,
  oop: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M6 16v-4h12v4" /></svg>,
};

const ART = { frontend: FrontendArt, pro: ProArt, python: PythonArt, backend: BackendArt, ai: AiArt, pc: PcArt, scratch: ScratchArt };

const FEAT_STEP = 2600; // мс на один блок у телефонному слайдері

/**
 * Блоки технологій. Ширше телефона — рядом усі; на телефоні — по одному по центру, змінюються самі
 * (вручну не гортаються). Змінюються лише поки картку видно.
 */
function Features({ items }) {
  const ref = useRef(null);
  const [on, setOn] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    let t = 0;
    const io = new IntersectionObserver(([e]) => {
      clearInterval(t);
      if (e.isIntersecting) t = setInterval(() => setOn((k) => (k + 1) % items.length), FEAT_STEP);
    });
    io.observe(el);
    return () => { io.disconnect(); clearInterval(t); };
  }, [items.length]);
  return (
    <ul className="s-dir-feats" ref={ref}>
      {items.map(([t, x, icon], k) => <li key={t} className={k === on ? 'is-on' : ''}>{icon && FEAT_ICON[icon]}<b>{t}</b>{x}</li>)}
    </ul>
  );
}

export function DirectionCard({ d, all }) {
  const lead = useLead();
  const Art = ART[d.art];
  const href = directionPath(d, all);
  return (
    <article className={['s-dir', d.look && `is-${d.look}`, d.artLeft && 'is-art-left', d.bg && `is-bg-${d.bg}`].filter(Boolean).join(' ')}>
      {d.look === 'py' && <div className="s-dir-pybg" aria-hidden="true">{PY_BG.map((l) => <span key={l}>{l}</span>)}</div>}
      <div className="s-dir-text">
        {d.badge && (
          <span className="s-dir-badges">
            <span className={`s-dir-badge ${d.badgeHot ? 'is-hot' : ''} ${d.badgePlain ? 'is-plain' : ''}`}>{d.badge}</span>
            {d.badgeExtra && <span className="s-dir-badge is-plain">{d.badgeExtra}</span>}
            {d.badgeNote && <small>{d.badgeNote}</small>}
          </span>
        )}
        {d.kicker && <span className="s-dir-kicker">{d.kicker}</span>}
        {d.wrap && <span className="s-dir-wrap" aria-hidden="true">{d.wrap[0]}</span>}
        <h3 className="s-dir-title">{d.titleMain ?? d.title}{d.titleAccent && <> <em>{d.titleAccent}</em></>}</h3>
        {d.wrap && <span className="s-dir-wrap" aria-hidden="true">{d.wrap[1]}</span>}
        {d.summary && <p className="s-dir-lead">{d.summary}</p>}
        {d.chips?.length > 0 && (
          <ol className="s-dir-path" aria-label="Шлях курсу">
            {d.chips.map((c, k) => <li key={c} className={k === d.chips.length - 1 ? 'is-goal' : ''}>{c}</li>)}
          </ol>
        )}
        {d.features?.length > 0 && <Features items={d.features} />}
        {d.codeLine && (
          <code className="s-dir-codeline">
            {d.codeLine[0]} = [{d.codeLine[1].map((x, k) => <span key={x}>{k > 0 && ', '}<u>"{x}"</u></span>)}]
          </code>
        )}
        <div className="s-dir-actions">
          <Link to={href} className="btn s-dir-more">Детальніше</Link>
          <button type="button" className="btn s-dir-go" onClick={() => lead(`Курс: ${d.title}`)}>Записатися</button>
        </div>
      </div>
      {Art && <Art />}
      {d.bg === 'play' && <span className="s-dir-deco is-play" aria-hidden="true"><i className="is-circle" /><i className="is-blk" /><i className="is-blk is-2" /><i className="is-blk is-3" /><i className="is-dot" /></span>}
      {d.bg === 'keys' && <span className="s-dir-deco is-keys" aria-hidden="true"><i>Esc</i><i>Ctrl</i><i>A</i><i>Space</i></span>}
      {d.bg === 'dots' && <span className="s-dir-deco is-ai" aria-hidden="true"><i className="is-star" /><i className="is-ring" /><i className="is-dot" /></span>}
      {d.look === 'dark' && <span className="s-dir-deco" aria-hidden="true"><i className="is-plus">+</i><i className="is-ring" /><i className="is-dot" /><i className="is-code">{'</>'}</i></span>}
    </article>
  );
}

/** Стрілка слайдера: помаранчева «таблетка», як у заголовку хіро. */
export function PillArrow({ left, label, disabled, onClick }) {
  return (
    <button type="button" className="s-pill-arrow" aria-label={label} disabled={disabled} onClick={onClick}>
      <Arrow left={left} />
    </button>
  );
}

/** Напрямки по одному на всю ширину. Гортається стрілками або пальцем (scroll-snap). */
export function DirectionSlider({ items, title = 'Курси' }) {
  const track = useRef(null);
  const [at, setAt] = useState(0);
  const go = useCallback((k) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(items.length - 1, k));
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  }, [items.length]);
  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    const on = () => setAt(Math.round(el.scrollLeft / (el.clientWidth || 1)));
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, []);
  return (
    <section className="s-wrap s-sec s-dir-sec" aria-roledescription="карусель" aria-label={title}>
      <div className="s-sec-head">
        <h2>{title}</h2>
        <div className="s-dir-nav">
          <PillArrow left label="Попередній курс" disabled={at <= 0} onClick={() => go(at - 1)} />
          <PillArrow label="Наступний курс" disabled={at >= items.length - 1} onClick={() => go(at + 1)} />
        </div>
      </div>
      <div className="s-dir-track" ref={track}>
        {items.map((d, k) => (
          <div key={d.id} className="s-dir-slide" aria-roledescription="слайд" aria-label={`${k + 1} з ${items.length}`}>
            <DirectionCard d={d} all={items} />
          </div>
        ))}
      </div>
    </section>
  );
}
