/* Проходження тесту по одному питанню, результат і розбір. */
import { useEffect, useRef, useState } from 'react';
import { Button, useUI } from '../../ui.jsx';
import { sfx } from '../../sound.js';
import { CodeText } from '../../codeText.jsx';
import { IconClose, IconLeft, IconRight, IconTick } from '../../icons.jsx';
import { plural } from '../../fmt.js';

/**
 * Питання тесту з варіантами. До здачі учень обирає відповіді; після здачі (review) видно правильні
 * варіанти й помилкові вибори. Спільне для тесту учня і тесту за публічним посиланням.
 */
export function QuizQuestions({ questions, done, review, answers, onPick, image }) {
  return (
    <ol className="q-take">
      {questions.map((x, i) => {
        const chosen = done ? x.chosen : answers[x.id] ?? [];
        return (
          <li key={x.id} className={`q-card ${done ? (x.right ? 'is-right' : 'is-wrong') : ''}`}>
            <header className="q-head">
              <h3>Питання {i + 1}</h3>
              {done && <span className={`q-mark ${x.right ? 'is-right' : 'is-wrong'}`}>{x.right ? 'Правильно' : 'Помилка'}</span>}
            </header>
            <div className="q-text"><CodeText text={x.text} kind="question" /></div>
            {x.image && <img className="q-img" src={image(x.image)} alt={`Картинка до питання ${i + 1}`} />}
            {x.multiple && !done && <p className="muted small">Кілька правильних відповідей</p>}
            <div className="q-opts" role={x.multiple ? 'group' : 'radiogroup'} aria-label={`Варіанти питання ${i + 1}`}>
              {x.options.map((o) => {
                const on = chosen.includes(o.id);
                const mark = review ? (o.correct ? 'tick' : on ? 'cross' : null) : on ? 'tick' : null;
                const cls = [on && 'is-on', review && o.correct && 'is-correct', review && on && !o.correct && 'is-miss'].filter(Boolean).join(' ');
                return (
                  <button key={o.id} type="button" className={`q-opt ${x.multiple ? 'is-multi' : ''} ${cls}`}
                    role={x.multiple ? 'checkbox' : 'radio'} aria-checked={on} disabled={review}
                    onClick={() => onPick(x, o.id)}>
                    <span className="q-box" aria-hidden="true">{mark === 'tick' ? <IconTick size={14} /> : mark === 'cross' ? <IconClose size={14} /> : null}</span>
                    <span><CodeText text={o.text} /></span>
                    {review && on && done && <span className="q-yours">ваш вибір</span>}
                    {review && on && !done && <span className="sr">, обрано</span>}
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export const pickIn = (answers, x, optionId) => {
  const cur = answers[x.id] ?? [];
  return { ...answers, [x.id]: x.multiple ? (cur.includes(optionId) ? cur.filter((v) => v !== optionId) : [...cur, optionId]) : [optionId] };
};

/** Текст тесту не копіюється: ні виділенням, ні контекстним меню, ні перетягуванням. */
export const noCopy = {
  onCopy: (e) => e.preventDefault(),
  onCut: (e) => e.preventDefault(),
  onContextMenu: (e) => e.preventDefault(),
  onDragStart: (e) => e.preventDefault(),
};

const LETTERS = 'ABCDEF';

/**
 * Проходження тесту по одному питанню. Одиночний вибір сам переходить далі; кілька відповідей — кнопкою «Далі».
 * Можна пропустити питання й повернутися назад, перейти до будь-якого через крапки вгорі.
 * Правильні відповіді не показуються: їх видно лише після «Завершити тест».
 * Клавіші: 1–6 обирають варіант, ← і → гортають, Enter — далі.
 */
export function QuizRunner({ questions, image, busy, onFinish }) {
  const [answers, setAnswers] = useState({});
  const [i, setI] = useState(0);
  const [dir, setDir] = useState('next');
  const [skipped, setSkipped] = useState(() => new Set());
  const timer = useRef(0);
  const { confirm } = useUI();
  const x = questions[i];
  const last = i === questions.length - 1;
  const has = (q) => Boolean(answers[q.id]?.length);
  const answered = questions.filter(has).length;

  const go = (to, how) => {
    clearTimeout(timer.current);
    if (to < 0 || to >= questions.length || to === i) return;
    setDir(to > i ? 'next' : 'prev');
    setI(to);
    (how === 'skip' ? sfx.skip : to > i ? sfx.next : sfx.back)();
  };
  const next = () => {
    if (!has(x)) setSkipped((s) => new Set(s).add(x.id));
    go(i + 1, has(x) ? 'next' : 'skip');
  };
  const pick = (o) => {
    const on = (answers[x.id] ?? []).includes(o.id);
    const nextAnswers = pickIn(answers, x, o.id);
    setAnswers(nextAnswers);
    setSkipped((s) => { const n = new Set(s); n.delete(x.id); return n; });
    (on && x.multiple ? sfx.unpick : sfx.pick)();
    // Одиночний вибір: коротка пауза, щоб побачити позначку, і далі.
    clearTimeout(timer.current);
    if (!x.multiple && !last) timer.current = setTimeout(() => { setDir('next'); setI((k) => k + 1); sfx.next(); }, 420);
  };
  const finish = async () => {
    clearTimeout(timer.current);
    const left = questions.length - answered;
    if (left > 0) {
      const yes = await confirm({ title: 'Завершити тест?', text: `Без відповіді ${left} ${plural(left, 'питання', 'питання', 'питань')}. Їх буде зараховано як неправильні.`, action: 'Завершити' });
      if (!yes) return;
    }
    onFinish(answers);
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, .modal')) return;
      const k = Number(e.key);
      if (k >= 1 && k <= x.options.length) { e.preventDefault(); pick(x.options[k - 1]); }
      else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !e.target.closest?.('button'))) { e.preventDefault(); if (last) finish(); else next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const chosen = answers[x.id] ?? [];
  return (
    <div className="qr" {...noCopy}>
      <div className="qr-top">
        <span className="qr-count">Питання <b>{i + 1}</b> з {questions.length}</span>
      </div>
      <ol className="qr-dots" aria-label="Питання тесту">
        {questions.map((q, k) => (
          <li key={q.id}>
            <button type="button" className={`qr-dot ${k === i ? 'is-current' : ''} ${has(q) ? 'is-done' : skipped.has(q.id) ? 'is-skipped' : ''}`}
              aria-label={`Питання ${k + 1}${has(q) ? ', є відповідь' : skipped.has(q.id) ? ', пропущено' : ''}`} aria-current={k === i ? 'step' : undefined}
              onClick={() => go(k)}>{k + 1}</button>
          </li>
        ))}
      </ol>

      <div className="qr-stage">
        <article key={x.id} className={`q-card qr-card is-${dir}`} aria-live="polite">
          <header className="q-head">
            <h3>Питання {i + 1}</h3>
            {x.multiple && <span className="qr-multi">Кілька правильних</span>}
          </header>
          <div className="q-text"><CodeText text={x.text} kind="question" /></div>
          {x.image && <img className="q-img" src={image(x.image)} alt={`Картинка до питання ${i + 1}`} draggable="false" />}
          <div className="q-opts" role={x.multiple ? 'group' : 'radiogroup'} aria-label={`Варіанти питання ${i + 1}`}>
            {x.options.map((o, k) => {
              const on = chosen.includes(o.id);
              return (
                <button key={o.id} type="button" style={{ '--k': k }} className={`q-opt qr-opt ${x.multiple ? 'is-multi' : ''} ${on ? 'is-on' : ''}`}
                  role={x.multiple ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => pick(o)}>
                  <span className="qr-key" aria-hidden="true">{on ? <IconTick size={14} /> : LETTERS[k]}</span>
                  <span><CodeText text={o.text} /></span>
                </button>
              );
            })}
          </div>
        </article>
      </div>

      <div className="quiz-submit qr-nav">
        <Button variant="ghost" icon={<IconLeft size={18} />} disabled={i === 0} onClick={() => go(i - 1)}>Назад</Button>
        {last
          ? <Button busy={busy} icon={<IconTick size={18} />} onClick={finish}>Завершити тест</Button>
          : has(x)
            ? <Button icon={<IconRight size={18} />} onClick={next}>Далі</Button>
            : <Button variant="ghost" icon={<IconRight size={18} />} onClick={next}>Пропустити</Button>}
      </div>
    </div>
  );
}

/** Результат: кільце з часткою правильних, бал і короткий відгук. Звук і конфеті — один раз при показі. */
export function ResultHero({ score, max, fresh, children }) {
  const share = max ? score / max : 0;
  const good = share >= 0.5;
  const title = share === 1 ? 'Ідеально!' : share >= 0.8 ? 'Чудовий результат' : good ? 'Добре, так тримати' : 'Варто повторити тему';
  useEffect(() => { if (fresh) (good ? sfx.win : sfx.soft)(); }, [fresh, good]);
  return (
    <section className={`quiz-score qr-result ${good ? 'is-good' : 'is-low'} ${fresh ? 'is-fresh' : ''}`} aria-label="Результат">
      {fresh && share >= 0.8 && (
        <div className="qr-confetti" aria-hidden="true">
          {Array.from({ length: 18 }, (_, k) => <i key={k} style={{ '--x': `${(k * 37) % 100}%`, '--d': `${(k % 6) * 90}ms`, '--r': `${(k * 47) % 360}deg`, '--c': k % 3 }} />)}
        </div>
      )}
      <div className="qr-dial">
        <svg className="qr-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="52" className="qr-ring-bg" />
          <circle cx="60" cy="60" r="52" className="qr-ring-fg" pathLength="1" style={{ '--share': share }} />
        </svg>
        <div className="qr-score">
          <strong>{score}<small> з {max}</small></strong>
          <span>{Math.round(share * 100)}%</span>
        </div>
      </div>
      <div className="qr-verdict">
        <h2>{title}</h2>
        <p>{Math.round(share * 100)}% правильних відповідей</p>
        {children}
      </div>
    </section>
  );
}

/** Розбір після завершення: усі питання з правильними відповідями й позначкою «правильно / помилка». */
export function QuizReview({ questions, image }) {
  return (
    <section className="qr-review" {...noCopy}>
      <h2>Відповіді</h2>
      <QuizQuestions questions={questions} done review answers={{}} onPick={() => {}} image={image} />
    </section>
  );
}
