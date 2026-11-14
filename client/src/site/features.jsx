/*
 * Секції «як навчаємо»: картки-макети кабінету, стопка (телефон), ряд (ширше) і підкладка з появою.
 * Макети — статичні картинки з розмітки, без даних.
 */
import { useEffect, useRef, useState } from 'react';
import { stackPos } from './logic.js';
import { prefersCalm, useMedia, useSeenOnce } from './motion.jsx';

const Tick = () => <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/* ───────── Макети ───────── */

/** Індивідуальні / групові заняття: без карток, просто текст прямо на секції — досвід викладачів. */
function TeamArt() {
  return (
    <div className="s-team">
      <p><span>За спиною наших викладачів</span> <span><mark>понад 3 роки</mark> викладання,</span></p>
      <p className="is-end"><span><mark>більше сотні</mark> випускників</span> <span>і задоволених родин!</span></p>
      <p className="s-team-sub">Ми точно знаємо, як пояснити те, що Вас цікавить.</p>
    </div>
  );
}

/* «Програмування легше, ніж здається»: без карток — ланцюжок «ідея → код → гра» прямо на секції */
const PLAY = [['Число? ', '5'], ['Більше!'], ['Число? ', '8'], ['Менше!'], ['Число? ', '7'], ['Вгадав! 🎉']];
function EasyFlow() {
  return (
    <ol className="s-flow">
      <li>
        <span className="s-flow-n">1<b>Ідея</b></span>
        <p className="s-flow-quote">«Хочу свою гру: компʼютер загадує число, а я вгадую»</p>
        <small>Звучить складно?</small>
      </li>
      <li>
        <span className="s-flow-n">2<b>Код</b></span>
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
        <small>Вісім рядків, і все</small>
      </li>
      <li>
        <span className="s-flow-n">3<b>Гра</b></span>
        <div className="s-art-term">
          {PLAY.map(([t, you], k) => <span key={k} style={{ '--k': k }} className={k === PLAY.length - 1 ? 'is-win' : ''}>{t}{you && <b>{you}</b>}</span>)}
        </div>
        <small>Працює! Це Ваша перша гра</small>
      </li>
    </ol>
  );
}

/* «Помилятися не страшно»: тест після теми, помилка, підказка викладача — і тему закрито */
const Cross = () => <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 4.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>;
function QuizArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Крок 1</b><span className="s-art-pill is-live">Тест</span></div>
      <b className="s-art-q">Що виведе <code>print("Ха" * 3)</code>?</b>
      <ul className="s-art-options s-art-easy">
        <li className="is-wrong">Ха3<Cross /></li>
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
        <div className="s-art-note"><span className="s-art-ava">ОК</span><p>Майже! Рядок, помножений на число, повторюється. Як зірочки в нашій грі</p></div>
        <div className="s-art-code"><span><u className="s">"Ха"</u> * <u className="n">3</u>  →  <u className="s">"ХаХаХа"</u></span></div>
      </div>
      <div className="s-art-row"><small>Помилка показує, що повторити</small></div>
    </div>
  );
}

function PassArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Крок 3</b><span className="s-art-pill is-ok">Тему закрито</span></div>
      <ul className="s-art-check s-art-easy">
        <li className="is-ok"><Tick />Цикли</li>
        <li className="is-ok"><Tick />Умови</li>
        <li className="is-ok"><Tick />Рядки<small>з другої спроби</small></li>
      </ul>
      <p className="s-art-done"><Tick />Тепер це знання назавжди</p>
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
        <div className="s-art-note"><span className="s-art-ava">ОК</span><p>Гра працює! Наступний крок: рахувати спроби</p></div>
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
      <p className="s-art-done"><Tick />Батькам теж усе видно</p>
    </div>
  );
}

/** Які макети показувати в секції (ключ — FEATURES[].icon з content.js). */
const FEATURE_ART = {
  solo: [TeamArt],
  check: [EasyFlow],
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
  const cards = FEATURE_ART[icon] ?? FEATURE_ART.solo;
  const wide = useMedia('(min-width: 600px)');
  const [ref, seen] = useSeenOnce({ threshold: 0.25 });
  return (
    <div ref={ref} className={`s-chapter-art is-v${variant} ${cards.length === 1 ? 'is-open' : ''} ${seen ? 'is-in' : ''}`}>
      {cards.length === 1
        ? (() => { const Card = cards[0]; return <Card />; })()
        : wide ? <CardRow cards={cards} /> : <CardStack cards={cards} />}
    </div>
  );
}
