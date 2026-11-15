/*
 * Секції «як навчаємо»: картки-макети кабінету, стопка (телефон), ряд (ширше) і підкладка з появою.
 * Макети — статичні картинки з розмітки, без даних.
 */
import { useEffect, useRef, useState } from 'react';
import { IconRight } from '../icons.jsx';
import { useLead } from './ctx.js';
import { stackPos } from './logic.js';
import { prefersCalm, useMedia, useSeenOnce } from './motion.jsx';

const Tick = () => <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/* ───────── Макети ───────── */

/* «Програмування легше, ніж здається»: жива гра «Вгадай число». Стрілка в кутку вікна відкриває код поруч,
   після перемоги в терміналі друкується, хто цю гру написав, і зʼявляється запис на пробне */
const MAX = 10;
const roll = () => 1 + Math.floor(Math.random() * MAX);
const WIN_TEXT = 'Цю гру написав учень на 3-му занятті.';

/** Друкує текст по літері; коли закінчив, кличе onDone. Без анімацій — одразу весь. */
function Typed({ text, onDone }) {
  const [n, setN] = useState(() => (prefersCalm() ? text.length : 0));
  useEffect(() => {
    if (n >= text.length) { onDone(); return undefined; }
    const t = setTimeout(() => setN((k) => k + 1), 38);
    return () => clearTimeout(t);
  }, [n, text, onDone]);
  return <><span aria-hidden="true">{text.slice(0, n)}{n < text.length && <i className="s-caret" />}</span><span className="sr-only">{text}</span></>;
}

const CODE = (
  <div className="s-art-code">
    <span><u className="k">from</u> random <u className="k">import</u> randint</span>
    <span>secret = <u className="f">randint</u>(<u className="n">1</u>, <u className="n">10</u>)</span>
    <span>guess = <u className="n">0</u></span>
    <span><u className="k">while</u> guess != secret:</span>
    <span>  guess = <u className="f">int</u>(<u className="f">input</u>(<u className="s">"Число? "</u>))</span>
    <span>  <u className="k">if</u> guess &lt; secret: <u className="f">print</u>(<u className="s">"Більше!"</u>)</span>
    <span>  <u className="k">if</u> guess &gt; secret: <u className="f">print</u>(<u className="s">"Менше!"</u>)</span>
    <span><u className="f">print</u>(<u className="s">"Вгадав! 🎉"</u>)</span>
  </div>
);

function GuessGame() {
  const lead = useLead();
  const [secret] = useState(roll);
  const [value, setValue] = useState('');
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState(false);
  // на десктопі код одразу відкритий поруч із грою, на телефоні — схований під стрілкою
  const [code, setCode] = useState(() => typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches);
  const won = log.at(-1)?.[1] === 'win';
  const listRef = useRef(null);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; });

  const guess = (e) => {
    e.preventDefault();
    const n = Number(value.trim());
    if (!/^\d+$/.test(value.trim()) || n < 1 || n > MAX) { setError(`Введіть ціле число від 1 до ${MAX}`); return; }
    setError('');
    setLog((l) => [...l, [n, n < secret ? 'more' : n > secret ? 'less' : 'win']]);
    setValue('');
  };

  return (
    <div className={`s-game ${code ? 'is-code' : ''}`}>
      <div className="s-game-stage">
        <div className="s-game-win">
          <div className="s-game-bar">
            <span className="s-game-dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="s-game-file">вгадай_число.py</span>
            <button type="button" className="s-game-toggle" aria-expanded={code} aria-controls="s-game-code"
              aria-label={code ? 'Сховати код гри' : 'Показати код гри'} title={code ? 'Сховати код' : 'Як це зроблено'} onClick={() => setCode(!code)}>
              <IconRight size={18} />
            </button>
          </div>
          <div className="s-game-out" ref={listRef} aria-live="polite">
            <p className="is-sys">Я загадав число від 1 до {MAX}. Спробуйте вгадати!</p>
            {log.map(([n, r], k) => (
              <p key={k}><span>Число? <b>{n}</b></span>{r === 'win' ? <em className="is-win">Вгадав! 🎉 Спроб: {log.length}</em> : <em>{r === 'more' ? 'Більше!' : 'Менше!'}</em>}</p>
            ))}
            {won && <p className="is-story"><Typed text={WIN_TEXT} onDone={() => setTyped(true)} /></p>}
          </div>
          {won ? (
            <div className={`s-game-done ${typed ? 'is-in' : ''}`}>
              {typed && <button type="button" className="btn btn-primary" onClick={() => lead('Хочу на пробне заняття')}>Спробувати<IconRight size={18} /></button>}
            </div>
          ) : (
            <form className="s-game-form" onSubmit={guess} noValidate>
              <label htmlFor="s-game-in">Число?</label>
              <input id="s-game-in" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={value} autoComplete="off"
                onChange={(e) => setValue(e.target.value)} placeholder={`1–${MAX}`} aria-invalid={error ? true : undefined} aria-describedby={error ? 's-game-err' : undefined} />
              <button type="submit" className="btn btn-primary">Перевірити</button>
            </form>
          )}
          {error && !won && <p className="s-game-err" id="s-game-err" role="alert">{error}</p>}
        </div>
        <div className="s-game-code" id="s-game-code" aria-hidden={!code}>
          <div className="s-game-bar"><span className="s-game-dots" aria-hidden="true"><i /><i /><i /></span><span className="s-game-file">код гри</span></div>
          {CODE}
          <p>Вісім рядків на Python, і гра готова.</p>
        </div>
      </div>
    </div>
  );
}

/* «Помилятися не страшно»: тест, підказка від викладача (людина, а не бот), звіт для батьків */
const Cross = () => <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 4.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>;

/** Репліка викладача: аватар з іменем, щоб було видно, що з помилкою розбирається людина. */
function TeacherNote({ children }) {
  return (
    <div className="s-art-note is-teacher">
      <span className="s-art-ava is-teacher" aria-hidden="true">О</span>
      <p><small className="s-art-who">Олена, викладачка Python</small>{children}</p>
    </div>
  );
}

function QuizArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Крок 1</b><span className="s-art-pill is-live">Тест</span></div>
      <b className="s-art-q">Що виведе <code>print("Ха" * 3)</code>?</b>
      <ul className="s-art-options s-art-easy">
        <li className="is-wrong"><span>Ха3<small>відповідь учня</small></span><Cross /></li>
        <li>ХаХаХа</li>
        <li>Помилка</li>
      </ul>
      <div className="s-art-row"><small>Ой, не те</small></div>
    </div>
  );
}

function HintArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Крок 2</b><span className="s-art-pill is-code">Підказка</span></div>
      <div className="s-art-easy is-idea">
        <TeacherNote>Майже! Рядок, помножений на число, просто повторюється стільки разів.</TeacherNote>
        <div className="s-art-code"><span><u className="s">"Ха"</u> * <u className="n">3</u>  →  <u className="s">"ХаХаХа"</u></span></div>
        <span className="s-art-btn">Спробувати ще раз</span>
      </div>
      <div className="s-art-row"><small>Викладач бачить, де саме дитина помилилась</small></div>
    </div>
  );
}

function PassArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Звіт для батьків</b><span className="s-art-pill is-ok">Тему закрито</span></div>
      <p className="s-art-report">Тема «Рядки» закрита з другої спроби</p>
      <ul className="s-art-check s-art-easy">
        <li className="is-ok"><Tick />Цикли</li>
        <li className="is-ok"><Tick />Умови</li>
        <li className="is-ok"><Tick />Рядки<small>щойно</small></li>
      </ul>
      <p className="s-art-done"><Tick />Ви бачите прогрес після кожної теми</p>
    </div>
  );
}

/* «Кабінет, де видно весь шлях»: нагадування, перевірене домашнє, прогрес курсу */
function TodayArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Сьогодні</b><span className="s-art-pill is-live">17:00</span></div>
      <div className="s-art-easy is-idea">
        <div className="s-art-ping"><b>🎮</b><span><small>Заняття о 17:00</small>Своя гра: додаємо рахунок</span></div>
        <ul className="s-art-lessons">
          <li><b>Ср</b><span><em>17:00</em>Своя гра: рівні</span></li>
          <li><b>Пт</b><span><em>16:00</em>Показуємо гру друзям</span></li>
        </ul>
      </div>
      <div className="s-art-row"><small>Розклад завжди під рукою</small></div>
    </div>
  );
}

function CheckedArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Домашнє «Вгадай число»</b><span className="s-art-pill is-ok">Перевірено</span></div>
      <div className="s-art-easy is-idea">
        <div className="s-art-term">
          <span>Число? <b>4</b></span>
          <span>Більше!</span>
          <span>Число? <b>6</b></span>
          <span className="is-win">Вгадав! 🎉</span>
        </div>
        <TeacherNote>Гра працює! Наступний крок: рахувати спроби</TeacherNote>
      </div>
      <div className="s-art-row"><small>Оцінка</small><b className="s-art-grade">12<span>/12</span></b></div>
    </div>
  );
}

const PATH = [['Основи Python', 1], ['Умови й цикли', 1], ['Своя гра', 0.6], ['Графіка', 0], ['Реліз гри', 0]];
function PathArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Мій шлях</b><small><b>52%</b></small></div>
      <ol className="s-art-path s-art-easy">
        {PATH.map(([t, v]) => <li key={t} className={v === 1 ? 'is-done' : v > 0 ? 'is-now' : ''} style={{ '--v': v }}><i>{v === 1 && <Tick />}</i>{t}</li>)}
      </ol>
    </div>
  );
}

/** Які макети показувати в секції (ключ — FEATURES[].icon з content.js). */
const FEATURE_ART = {
  check: [GuessGame],
  quiz: [QuizArt, HintArt, PassArt],
  cabinet: [TodayArt, CheckedArt, PathArt],
};

/* ───────── Як показувати ───────── */

const STACK_STEP = 3400; // мс на картку
const STACK_HELD = 9000; // обрану вручну тримаємо довше

/** Стопка карток (телефон): передня по колу йде назад, наступна виходить уперед. Крутиться, лише коли видно. */
function CardStack({ cards }) {
  const ref = useRef(null);
  const [front, setFront] = useState(0);
  const [run, setRun] = useState(false);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || prefersCalm()) return undefined;
    const io = new IntersectionObserver(([e]) => setRun(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!run) return undefined;
    const t = setTimeout(() => { setHeld(false); setFront((f) => (f + 1) % cards.length); }, held ? STACK_HELD : STACK_STEP);
    return () => clearTimeout(t);
  }, [run, front, held, cards.length]);
  return (
    <div className="s-stack" ref={ref}>
      <div className="s-stack-cards">
        {cards.map((Card, k) => {
          const pos = stackPos(k, front, cards.length);
          return <div key={k} className="s-stack-item" data-pos={pos} aria-hidden={pos !== 0}><Card /></div>;
        })}
      </div>
      <div className="s-stack-dots">
        {cards.map((_, k) => <button key={k} type="button" className={k === front ? 'is-on' : ''} aria-label={`Картка ${k + 1}`} onClick={() => { setFront(k); setHeld(true); }} />)}
      </div>
    </div>
  );
}

/** Ряд карток (від планшета): виїжджають по черзі, коли ряд потрапив на екран. */
function CardRow({ cards }) {
  const [ref, seen] = useSeenOnce({ threshold: 0.2 });
  return (
    <div className={`s-card-row ${seen ? 'is-in' : ''}`} ref={ref}>
      {cards.map((Card, k) => <div key={k} className="s-card-row-item" style={{ '--k': k }}><Card /></div>)}
    </div>
  );
}

/**
 * Підкладка з картками секції. На телефоні клітинки фону будуються згори вниз,
 * а стопка виїжджає по-своєму в кожній секції (variant 0–3).
 */
export function FeatureArt({ icon, variant }) {
  const cards = FEATURE_ART[icon] ?? FEATURE_ART.check;
  // три картки в ряд лише від 900px: вужче вони надто стискаються, тож там стопка з накладанням
  const wide = useMedia('(min-width: 900px)');
  const [ref, seen] = useSeenOnce({ threshold: 0.25 });
  return (
    <div ref={ref} className={`s-chapter-art is-v${variant} ${cards.length === 1 ? 'is-open' : ''} ${seen ? 'is-in' : ''}`}>
      {cards.length === 1
        ? (() => { const Card = cards[0]; return <Card />; })()
        : wide ? <CardRow cards={cards} /> : <CardStack cards={cards} />}
    </div>
  );
}
