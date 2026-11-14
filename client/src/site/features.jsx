/*
 * Секції «як навчаємо»: картки-макети кабінету, стопка (телефон), ряд (ширше) і підкладка з появою.
 * Макети — статичні картинки з розмітки, без даних.
 */
import { useEffect, useRef, useState } from 'react';
import { stackPos } from './logic.js';
import { prefersCalm, useMedia, useSeenOnce } from './motion.jsx';

const Tick = () => <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/* ───────── Макети ───────── */

/** Індивідуальні заняття: картка викладача — хто веде, як проходять заняття, коли наступне. */
function SoloArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Ваш викладач</b><span className="s-art-pill is-ok">1 на 1</span></div>
      <div className="s-art-teacher">
        <span className="s-art-ava is-big">ОК</span>
        <span><b>Олена Коваль</b><small>Python і веброзробка</small></span>
      </div>
      <ul className="s-art-facts">
        <li><span>Формат</span><b>Лише Ви й викладач</b></li>
        <li><span>Тривалість</span><b>60 хвилин</b></li>
        <li><span>Темп</span><b>Під Вас</b></li>
      </ul>
      <div className="s-art-row"><small>Наступне заняття</small><small><b>Вт, 17:00</b></small></div>
    </div>
  );
}

function PlanArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Ваша програма</b><span className="s-art-pill is-ok">Індивідуально</span></div>
      <div className="s-art-note"><span className="s-art-ava is-you">Ви</span><p>Хочу робити свої ігри!</p></div>
      <ol className="s-art-plan">
        <li><b>1</b>Основи Python</li>
        <li><b>2</b>Pygame: перша гра</li>
        <li><b>3</b>Своя гра від ідеї до релізу</li>
      </ol>
    </div>
  );
}

/** Зручний час: тиждень із датами, обрані заняття окремими рядками, перенесення без штрафів. */
const WEEK = [['Пн', 10], ['Вт', 11], ['Ср', 12], ['Чт', 13], ['Пт', 14], ['Сб', 15], ['Нд', 16]];
const BUSY = new Set(['Вт', 'Пт']);
function TimeArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Зручний час</b><small>Листопад</small></div>
      <div className="s-art-days">
        {WEEK.map(([d, n]) => <span key={d} className={BUSY.has(d) ? 'is-on' : ''}><small>{d}</small><b>{n}</b></span>)}
      </div>
      <ul className="s-art-slots">
        <li><b>Вт</b><span><em>17:00</em>Python з викладачем</span></li>
        <li><b>Пт</b><span><em>15:30</em>Python з викладачем</span></li>
      </ul>
      <p className="s-art-move"><Tick />Перенести можна без штрафів</p>
    </div>
  );
}

function HomeworkArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Домашнє «Цикли»</b><span className="s-art-pill is-ok">Перевірено</span></div>
      <div className="s-art-code"><span><u className="k">for</u> n <u className="k">in</u> <u className="f">range</u>(<u className="n">5</u>):</span><span>    <u className="f">print</u>(n * n)</span></div>
      <div className="s-art-note"><span className="s-art-ava">ОК</span><p>Гарно! Наступного разу спробуйте винести це у функцію.</p></div>
      <div className="s-art-row"><small>Оцінка</small><b className="s-art-grade">11<span>/12</span></b></div>
    </div>
  );
}

function TaskArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Нове домашнє</b><span className="s-art-pill is-live">до пт</span></div>
      <p className="s-art-task">Зробіть гру «Вгадай число»: компʼютер загадує, Ви вгадуєте, а програма підказує «більше» чи «менше».</p>
      <div className="s-art-row"><small>Тема «Цикли»</small><span className="s-art-btn">Здати роботу</span></div>
    </div>
  );
}

function StreakArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Домашні за місяць</b><b className="s-art-grade is-green">8<span>/8</span></b></div>
      <div className="s-art-streak">{Array.from({ length: 8 }, (_, k) => <i key={k}><Tick /></i>)}</div>
      <div className="s-art-row"><small>Середня оцінка</small><small><b>10,5</b> з 12</small></div>
    </div>
  );
}

function QuizArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><small>Тест «Цикли»</small><small>3 з 10</small></div>
      <b className="s-art-q">Що виведе <code>print(2 ** 3)</code>?</b>
      <ul className="s-art-options">
        <li>6</li>
        <li className="is-right">8<Tick /></li>
        <li>9</li>
      </ul>
      <div className="s-art-row"><small>Результат</small><b className="s-art-grade is-green">9<span>/10</span></b></div>
    </div>
  );
}

function ResultArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Тест «Умови»</b><b className="s-art-grade is-green">9<span>/10</span></b></div>
      <ul className="s-art-check">
        <li className="is-ok"><Tick />if та else</li>
        <li className="is-ok"><Tick />Порівняння</li>
        <li className="is-again"><span>!</span>Логічні оператори<small>повторити</small></li>
      </ul>
    </div>
  );
}

function Quiz2Art() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><small>Тест «Рядки»</small><small>5 з 10</small></div>
      <b className="s-art-q">Що поверне <code>len("код")</code>?</b>
      <ul className="s-art-options">
        <li className="is-right">3<Tick /></li>
        <li>4</li>
        <li>"код"</li>
      </ul>
    </div>
  );
}

function CabinetArt() {
  return (
    <div className="s-art-card">
      <small className="s-art-label">Найближчі заняття</small>
      <ul className="s-art-lessons">
        <li><b>Пн</b><span><em>17:00</em>Python. Старт</span></li>
        <li><b>Ср</b><span><em>17:00</em>Python. Старт</span></li>
        <li><b>Пт</b><span><em>16:00</em>Розбір домашнього</span></li>
      </ul>
      <div className="s-art-row"><small>Абонемент</small><small><b>6</b> з 8 занять</small></div>
      <div className="s-mock-progress"><i style={{ width: '75%' }} /></div>
    </div>
  );
}

function TicketArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Абонемент</b><span className="s-art-pill is-ok">Активний</span></div>
      <div className="s-art-ticket"><b>6</b><span>занять лишилось<small>з 8</small></span></div>
      <div className="s-mock-progress"><i style={{ width: '75%' }} /></div>
    </div>
  );
}

const GRADES = [9, 11, 10, 12, 11, 12];
function GradesArt() {
  return (
    <div className="s-art-card">
      <div className="s-art-row"><b>Оцінки</b><small>останні 6</small></div>
      <div className="s-art-bars">{GRADES.map((v, k) => <span key={k} style={{ '--h': `${(v / 12) * 100}%` }}><b>{v}</b></span>)}</div>
      <div className="s-art-row"><small>Прогрес курсу</small><small><b>64%</b></small></div>
    </div>
  );
}

/** Які макети показувати в секції (ключ — FEATURES[].icon з content.js). */
const FEATURE_ART = {
  solo: [SoloArt, PlanArt, TimeArt],
  check: [HomeworkArt, TaskArt, StreakArt],
  quiz: [QuizArt, ResultArt, Quiz2Art],
  cabinet: [CabinetArt, TicketArt, GradesArt],
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
    <div ref={ref} className={`s-chapter-art is-v${variant} ${seen ? 'is-in' : ''}`}>
      {wide ? <CardRow cards={cards} /> : <CardStack cards={cards} />}
    </div>
  );
}
