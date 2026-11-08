import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useData } from '../api.js';
import { useAuth, useIsMobile } from '../session.jsx';
import { Button, Checkbox, Collapse, Empty, ErrorNote, IconButton, Input, Linkify, Loader, Modal, PageHead, Segmented, Select, Status, Textarea, useAction, useUI } from '../ui.jsx';
import { IconCopy, IconDown, IconEdit, IconHomework, IconLeft, IconPeople, IconPlus, IconQuiz, IconRight, IconRoadmap, IconSpark, IconTick, IconTrash, IconUp } from '../icons.jsx';
import { dateTimeShort, nowLocal, plural } from '../fmt.js';
import { CourseForm } from './Courses.jsx';
import { HW_STATUS } from './Homework.jsx';
import RoadmapAi from './RoadmapAi.jsx';
import { CourseIcon, themeClass } from '../courseLook.jsx';
import { Avatar, Who } from '../avatars.jsx';
import { ISLAND_DESIGNS } from '../islandDesigns.js';
import { QUIZ_PROMPT, parseQuizAnswer } from '../quizImport.js';

/** Частка пройденого етапу: підпункти рахуються по одному, етап без підпунктів — цілим. */
const stepShare = (s, doneIds, doneSubs) => {
  if (doneIds.has(s.id)) return 1;
  if (!s.substeps.length) return 0;
  return s.substeps.filter((x) => doneSubs.has(x.id)).length / s.substeps.length;
};

/** Стан домашнього для учня; без учня (вчитель ще не обрав) стану немає. */
const hwState = (h, viewerId) => (viewerId ? h.results.find((r) => r.student_id === viewerId)?.status ?? 'todo' : null);

/** Підсумок для учня: скільки пройдено, де він зараз і що з домашніми курсу. */
function ProgressCard({ steps, doneIds, doneSubs, homework, viewerId, isStudent }) {
  const share = steps.reduce((sum, s) => sum + stepShare(s, doneIds, doneSubs), 0);
  const pct = steps.length ? Math.round((share / steps.length) * 100) : 0;
  const doneSteps = steps.filter((s) => doneIds.has(s.id)).length;
  const currentIndex = steps.findIndex((s) => !doneIds.has(s.id));
  const current = steps[currentIndex];
  const states = homework.map((h) => hwState(h, viewerId));
  const accepted = states.filter((s) => s === 'accepted').length;
  const returned = states.filter((s) => s === 'returned').length;
  const open = states.filter((s) => s === 'todo').length;
  return (
    <section className="course-progress" aria-label={isStudent ? 'Мій прогрес на курсі' : 'Підсумок курсу для обраного учня'}>
      <div className="cp-main">
        <strong className="cp-pct">{pct}%</strong>
        <div className="cp-text">
          <span className="progress" role="img" aria-label={`Пройдено ${pct}%`}><i style={{ width: `${pct}%` }} /></span>
          <p className="small">
            {doneSteps === steps.length
              ? 'Усі етапи пройдено'
              : <>Пройдено {doneSteps} з {steps.length} {plural(steps.length, 'етапу', 'етапів', 'етапів')}. Зараз: <b>{currentIndex + 1}. {current.title}</b></>}
          </p>
        </div>
      </div>
      {homework.length > 0 && (
        <ul className="cp-hw" aria-label="Домашні курсу">
          <li><b>{accepted}</b> з {homework.length} домашніх прийнято</li>
          {open > 0 && <li className="is-warn">треба здати: <b>{open}</b></li>}
          {returned > 0 && <li className="is-red">на виправлення: <b>{returned}</b></li>}
        </ul>
      )}
    </section>
  );
}

/** Тести під етапом: непройдений кличе «Пройти тест», пройдений показує бал. */
function StepQuizzes({ items, step, links }) {
  if (!items.length) return null;
  return (
    <ul className="road-hw" aria-label={`Тести етапу «${step.title}»`}>
      {items.map((z) => {
        const subTitles = z.topics
          .filter((t) => t.step_id === step.id && t.substep_id)
          .map((t) => step.substeps.find((x) => x.id === t.substep_id)?.title)
          .filter(Boolean);
        const body = (
          <>
            <IconQuiz size={16} />
            <span className="road-hw-title">
              {z.title}
              {subTitles.length > 0 && <small className="muted"> · {subTitles.join(', ')}</small>}
            </span>
            {z.submitted_at
              ? <Status kind={z.score / z.max_score >= 0.5 ? 'completed' : 'cancelled'}>{z.score} з {z.max_score}</Status>
              : <span className="road-quiz-go">{links ? 'Пройти тест' : 'Не пройдено'}{links && <IconRight size={16} />}</span>}
          </>
        );
        return (
          <li key={z.id}>
            {links
              ? <Link to={`/tests/${z.id}`} className={`road-hw-item is-quiz ${z.submitted_at ? '' : 'is-open'}`}>{body}</Link>
              : <div className={`road-hw-item is-quiz ${z.submitted_at ? '' : 'is-open'}`}>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** Домашні під етапом роадмапу: назва, підтема, термін і стан для обраного учня. */
function StepHomework({ items, step, viewerId }) {
  if (!items.length) return null;
  const now = nowLocal();
  return (
    <ul className="road-hw" aria-label={`Домашні етапу «${step.title}»`}>
      {items.map((h) => {
        const subTitles = h.topics
          .filter((t) => t.step_id === step.id && t.substep_id)
          .map((t) => step.substeps.find((x) => x.id === t.substep_id)?.title)
          .filter(Boolean);
        const st = hwState(h, viewerId);
        const late = st && st !== 'accepted' && st !== 'submitted' && h.due_at < now;
        return (
          <li key={h.id}>
            <Link to={`/homework/${h.id}`} className="road-hw-item">
              <IconHomework size={16} />
              <span className="road-hw-title">
                {h.title}
                {subTitles.length > 0 && <small className="muted"> · {subTitles.join(', ')}</small>}
              </span>
              <small className={late ? 'text-red' : 'muted'}>до {dateTimeShort(h.due_at)}</small>
              {st && <Status kind={HW_STATUS[st][0]}>{HW_STATUS[st][1]}</Status>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Геометрія дороги. Має збігатися з .stop у styles.css.
 * Телефон: дорога в’ється вздовж лівого краю. Широкий екран: серпантин на всю ширину,
 * кружки чергуються біля лівого й правого краю, а між етапами дорога перетинає сторінку.
 */
const ROAD = {
  mobile: { x: [24, 50], radius: 22 },
  wide: { radius: 36 },
};
const MAX_PIPS = 10;

/** Кільце навколо кружка: частка пройдених підпунктів. */
function StopRing({ fraction }) {
  return (
    <svg className="stop-ring" viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r="24" pathLength="1" style={{ strokeDasharray: `${fraction} 1`, strokeOpacity: fraction > 0 ? 1 : 0 }} />
    </svg>
  );
}

function SubToggle({ open, done, total, onClick, label }) {
  return (
    <button type="button" className={`sub-toggle ${open ? 'is-open' : ''}`} aria-expanded={open} onClick={onClick}>
      {done != null && total <= MAX_PIPS && (
        <span className="pips" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => <i key={i} className={i < done ? 'is-on' : ''} />)}
        </span>
      )}
      <span>{label}</span>
      <IconDown size={16} className="chev" />
    </button>
  );
}

/** Прапорець фінішу. */
const IconFlag = ({ size }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 21V4" /><path d="M5 4.5c4-2 7 2 13 0v9c-6 2-9-2-13 0" />
  </svg>
);

/** Відрізок серпантину: вниз уздовж краю, плавний поворот, перетин сторінки, поворот, вниз до кружка. */
function switchback(x0, y0, x1, y1, yc) {
  const s = Math.sign(x1 - x0) || 1;
  const t = Math.max(0, Math.min(72, yc - y0, y1 - yc, Math.abs(x1 - x0) / 2));
  const k = t * 0.45;
  return `M${x0} ${y0} L${x0} ${yc - t} C${x0} ${yc - k}, ${x0 + s * k} ${yc}, ${x0 + s * t} ${yc}`
    + ` L${x1 - s * t} ${yc} C${x1 - s * k} ${yc}, ${x1} ${yc + k}, ${x1} ${yc + t} L${x1} ${y1}`;
}
const wave = (x0, y0, x1, y1) => {
  const mid = (y1 - y0) / 2;
  return `M${x0} ${y0} C${x0} ${y0 + mid}, ${x1} ${y1 - mid}, ${x1} ${y1}`;
};

/** Живий 3D-острівець. three.js вантажиться лише тоді, коли на сторінці є острівець. */
function Island3D({ design, number, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    let off = null;
    let gone = false;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    import('../island3d.js')
      .then(({ mountIsland }) => { if (!gone && ref.current) off = mountIsland(ref.current, { design, number, still }); })
      .catch(() => ref.current?.classList.add('is-flat'));
    return () => { gone = true; off?.(); };
  }, [design, number]);
  return <div ref={ref} className={`island3d ${className}`} data-design={design} aria-hidden="true"><span className="island-fallback">{number}</span></div>;
}

/** Острівець на місці номера етапу: учень відкриває тест, співробітник бачить стан модерації. */
function IslandSpot({ island, number, result, onOpen, staff }) {
  const pending = island.quiz_status !== 'approved';
  const state = pending ? (island.quiz_status === 'rejected' ? 'Відхилено' : 'На модерації')
    : result?.submitted_at ? `${result.score} з ${result.max_score}` : staff ? `${island.questions_count} питань` : 'Пройти тест';
  const tone = pending ? 'is-wait' : result?.submitted_at ? (result.score / result.max_score >= 0.5 ? 'is-good' : 'is-low') : 'is-open';
  return (
    <div className="road-island" data-step={island.step_id}>
      <button type="button" className="island-hit" onClick={onOpen} aria-label={`Острівець ${number}: тест «${island.quiz_title}», ${state}`}>
        <Island3D design={island.design} number={number} />
        <span className="island-label">
          <IconQuiz size={15} />
          <span className="island-title">{island.quiz_title}</span>
          <span className={`island-state ${tone}`}>{state}</span>
        </span>
      </button>
    </div>
  );
}

/** Тема етапу текстом: назва, опис і підтеми. Її копіюють у чат зі ШІ разом із промптом. */
const topicText = (step, n) => [
  `Етап ${n}. ${step.title}`,
  step.description,
  step.substeps.length ? `Підтеми:\n${step.substeps.map((x) => `- ${x.title}`).join('\n')}` : null,
].filter(Boolean).join('\n');

/** Налаштування острівця: тест (новий із відповіді ШІ або з бібліотеки) і дизайн. */
function IslandForm({ course, step, island, isManager, sourceText, onClose, onDone }) {
  const library = useData('/quizzes/library');
  const [mode, setMode] = useState(island ? 'library' : 'new');
  const [quizId, setQuizId] = useState(island?.quiz_id ?? null);
  const [text, setText] = useState('');
  const [design, setDesign] = useState(island?.design ?? 'terminal');
  const [run, busy] = useAction();
  const { confirm } = useUI();
  const parsed = text.trim() ? parseQuizAnswer(text) : null;
  const found = parsed?.questions.length ?? 0;
  const unmarked = parsed?.questions.some((x) => !x.options.some((o) => o.correct));
  const ready = mode === 'new' ? found > 0 && !unmarked : Boolean(quizId);

  const save = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      let qid = quizId;
      if (mode === 'new') {
        const r = await api('/quizzes', { method: 'POST', body: { title: parsed.title || `Тест: ${step.title}`, description: '', questions: parsed.questions } });
        qid = r.id;
      }
      return api(`/courses/${course.id}/islands/${step.id}`, { method: 'PUT', body: { quiz_id: qid, design } });
    }, isManager || mode === 'library' ? 'Острівець збережено' : 'Тест надіслано на модерацію');
    if (ok) onDone();
  };
  const remove = async () => {
    const yes = await confirm({ title: 'Прибрати острівець?', text: 'Тест лишиться в списку тестів, а на роадмапі знову буде номер етапу.', action: 'Прибрати', danger: true });
    if (yes && (await run(() => api(`/courses/${course.id}/islands/${step.id}`, { method: 'DELETE' }), 'Острівець прибрано'))) onDone();
  };

  return (
    <Modal title={island ? 'Острівець тестування' : 'Тестування на острівець'} onClose={onClose}>
      <form className="form isle-form" onSubmit={save}>
        <p className="muted small">Етап «{step.title}». Острівець стане на місце номера етапу.</p>
        <Segmented value={mode} onChange={setMode} options={[{ value: 'new', label: 'Новий тест' }, { value: 'library', label: 'З тестів' }]} />
        {mode === 'new' ? (
          <>
            <p className="small muted">
              Скопіюйте промпт із темою попереднього етапу, надішліть у будь-який ШІ й вставте відповідь сюди.
            </p>
            <div className="isle-copy">
              <button type="button" className="link-btn" onClick={() => sourceText('prompt')}><IconCopy size={14} /> Скопіювати промпт</button>
              <button type="button" className="link-btn" onClick={() => sourceText('topic')}><IconCopy size={14} /> Скопіювати тему</button>
            </div>
            <Textarea label="Відповідь ШІ" rows={7} maxLength={60000} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={'Назва: …\n\n? Питання\n+ правильний варіант\n- неправильний варіант'} />
            {parsed && (
              <p className={`small ${found && !unmarked ? '' : 'text-red'}`} role="status">
                {!found ? 'Не знайдено жодного питання. Перевірте формат відповіді.'
                  : unmarked ? 'У деяких питаннях немає позначок «+» і «−». Скопіюйте відповідь кнопкою над блоком коду.'
                  : <>Знайдено {found} {plural(found, 'питання', 'питання', 'питань')}{parsed.title && <> · «{parsed.title}»</>}</>}
              </p>
            )}
            {!isManager && <p className="note small">Тест вчителя спершу перевіряє менеджер. Учні побачать острівець після схвалення.</p>}
            {isManager && <p className="muted small">Тест також з’явиться в загальному списку тестів.</p>}
          </>
        ) : (
          <Select label="Тест" value={quizId} onChange={setQuizId} placeholder={library.data?.length ? 'Оберіть тест' : 'Тестів ще немає'}
            options={(library.data ?? []).map((z) => ({ value: z.id, label: z.title, hint: `${z.questions_count} питань${z.status === 'pending' ? ' · на модерації' : ''}` }))} />
        )}
        <fieldset className="isle-designs">
          <legend>Дизайн острівця</legend>
          <div role="radiogroup" aria-label="Дизайн острівця">
            {ISLAND_DESIGNS.map((d) => (
              <button key={d.id} type="button" role="radio" aria-checked={design === d.id} className={`isle-design ${design === d.id ? 'is-on' : ''}`}
                onClick={() => setDesign(d.id)}>
                <Island3D design={d.id} number="01" className="is-mini" />
                <strong>{d.label}</strong>
                <small>{d.hint}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="form-actions">
          {island && <Button variant="ghost" icon={<IconTrash size={18} />} onClick={remove}>Прибрати</Button>}
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy} disabled={!ready}>{island ? 'Зберегти' : 'Поставити острівець'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Звивиста дорога. Висота рядків залежить від підпунктів, тому точки вимірюємо з DOM. */
function RoadmapPath({ steps, doneIds, doneSubs, canMark, onToggleStep, onToggleSub, homework = [], quizzes = [], quizLinks = false, viewerId = null, islands = [], isle = null }) {
  const mobile = useIsMobile();
  const geo = mobile ? ROAD.mobile : ROAD.wide;
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const finishRef = useRef(null);
  const [box, setBox] = useState(null);
  const [overrides, setOverrides] = useState({});

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    const measure = () => {
      const rows = [...el.children].map((row) => {
        const stop = row.querySelector('.stop');
        const card = row.querySelector('.road-text');
        return {
          y: row.offsetTop + stop.offsetTop + stop.offsetHeight / 2,
          x: stop.offsetLeft + stop.offsetWidth / 2,
          cardBottom: row.offsetTop + card.offsetTop + card.offsetHeight,
          top: row.offsetTop,
        };
      });
      const f = finishRef.current;
      const flag = f?.querySelector('.road-flag');
      const finish = flag ? { x: f.offsetLeft + flag.offsetLeft + flag.offsetWidth / 2, y: f.offsetTop + flag.offsetTop + flag.offsetHeight / 2 } : null;
      setBox({ rows, finish });
    };
    measure();
    // Спрацьовує щокадру під час розгортання, тому дорога рухається разом із рядками.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (rootRef.current) observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [steps.length, mobile]);

  const firstOpen = steps.findIndex((s) => !doneIds.has(s.id));
  const allDone = firstOpen === -1;
  const ready = box && box.rows.length === steps.length && steps.length > 0;

  const piece = (a, b) => {
    if (mobile) return wave(a.x, a.y, b.x, b.y);
    // Середина проміжку між карткою і наступним етапом: тут дорога перетинає сторінку.
    const yc = (Math.max(a.cardBottom, a.y + 40) + b.top) / 2;
    return switchback(a.x, a.y, b.x, b.y, Math.min(yc, b.y - 24));
  };
  // Пройдена частина: від пройденого етапу дорога заливається до наступного на його частку.
  const fill = (i) => {
    if (!doneIds.has(steps[i].id)) return 0;
    const next = steps[i + 1];
    return doneIds.has(next.id) ? 1 : Math.max(stepShare(next, doneIds, doneSubs), 0.5);
  };
  const segments = ready
    ? steps.slice(0, -1).map((s, i) => ({ id: s.id, d: piece(box.rows[i], box.rows[i + 1]), fill: fill(i), full: doneIds.has(s.id) && doneIds.has(steps[i + 1].id) }))
    : [];
  const last = ready ? box.rows[box.rows.length - 1] : null;
  const tail = ready && box.finish
    ? (mobile
      ? wave(last.x, last.y, box.finish.x, box.finish.y)
      : switchback(last.x, last.y, box.finish.x, box.finish.y, Math.min((Math.max(last.cardBottom, last.y + 40) + box.finish.y - 40) / 2, box.finish.y - 24)))
    : null;
  const lastDone = steps.length > 0 && doneIds.has(steps[steps.length - 1].id);

  return (
    <div ref={rootRef} className={`road ${ready ? 'is-ready' : ''}`} style={mobile ? { '--road-text': `${geo.x[1] + geo.radius + 14}px` } : undefined}>
      <svg className="road-line" width="100%" height="100%" aria-hidden="true">
        <g className="road-edge">{segments.map((s) => <path key={s.id} d={s.d} />)}{tail && <path d={tail} />}</g>
        <g className="road-bed">{segments.map((s) => <path key={s.id} d={s.d} />)}</g>
        {tail && <path className="road-tail" d={tail} />}
        <g>
          {segments.map((s) => (
            <path key={s.id} d={s.d} pathLength="1" className={`road-done ${s.full ? 'is-done' : ''}`}
              style={{ strokeDashoffset: 1 - s.fill, opacity: s.fill > 0 ? 1 : 0 }} />
          ))}
          {tail && <path d={tail} pathLength="1" className={`road-done ${allDone ? 'is-done' : ''}`}
            style={{ strokeDashoffset: lastDone ? 0 : 1, opacity: lastDone ? 1 : 0 }} />}
        </g>
        <g className="road-mark">{segments.map((s) => <path key={s.id} d={s.d} />)}{tail && <path d={tail} />}</g>
      </svg>
      <ol ref={listRef} className="road-list">
        {steps.map((s, i) => {
          const done = doneIds.has(s.id);
          const current = i === firstOpen;
          const total = s.substeps.length;
          const subsDone = s.substeps.filter((x) => doneSubs.has(x.id)).length;
          const open = overrides[s.id] ?? current;
          const cls = `stop ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`;
          const left = mobile ? geo.x[i % 2] - geo.radius : undefined;
          const label = `${s.title}: ${done ? 'пройдено' : total ? `пройдено ${subsDone} із ${total}` : 'не пройдено'}`;
          const inner = (
            <>
              {total > 0 && !done && <StopRing fraction={subsDone / total} />}
              {done ? <IconTick size={mobile ? 20 : 28} /> : i + 1}
            </>
          );
          const state = done ? 'Пройдено' : current ? 'Ви тут' : 'Попереду';
          const pct = done ? 100 : total ? Math.round((subsDone / total) * 100) : 0;
          return (
            <li key={s.id} className={`road-row ${i % 2 ? 'is-right' : 'is-left'} ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`} style={{ '--i': Math.min(i, 10) }}>
              {canMark ? (
                <button type="button" className={cls} style={{ left }} aria-pressed={done} aria-label={label}
                  title={done ? 'Зняти позначку' : 'Позначити пройденим'} onClick={() => onToggleStep(s, !done, subsDone)}>{inner}</button>
              ) : (
                <span className={cls} style={{ left }} role="img" aria-label={label}>{inner}</span>
              )}
              {(() => {
                const island = islands.find((x) => x.step_id === s.id);
                if (!island || !isle) return <span className="road-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>;
                return <IslandSpot island={island} number={String(i + 1).padStart(2, '0')} result={quizzes.find((z) => z.quiz_id === island.quiz_id && z.student_id === viewerId)}
                  onOpen={() => isle.open(s, island)} staff={isle.staff} />;
              })()}
              <div className="road-text">
                <div className="road-eyebrow">
                  <span className="road-state">{state}</span>
                  {total > 0 && <span className="road-pct">{pct}%</span>}
                </div>
                <h3>{s.title}</h3>
                {s.description && <p className="road-desc">{s.description}</p>}
                {isle?.canEdit && (
                  <div className="isle-tools">
                    <Button small variant={islands.some((x) => x.step_id === s.id) ? 'ghost' : 'primary'} icon={<IconQuiz size={16} />} onClick={() => isle.edit(s, i)}>
                      {islands.some((x) => x.step_id === s.id) ? 'Змінити острівець' : 'Додати тестування на острівець'}
                    </Button>
                    <div className="isle-copy">
                      <button type="button" className="link-btn" onClick={() => isle.copy('topic', i)}><IconCopy size={14} /> Скопіювати тему</button>
                      <button type="button" className="link-btn" onClick={() => isle.copy('prompt', i)}><IconCopy size={14} /> Скопіювати промпт</button>
                    </div>
                  </div>
                )}
                {total > 0 && <span className="road-meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
                <StepHomework step={s} viewerId={viewerId} items={homework.filter((h) => h.topics.some((t) => t.step_id === s.id))} />
                <StepQuizzes step={s} links={quizLinks} items={quizzes.filter((z) => z.topics.some((t) => t.step_id === s.id))} />
                {total > 0 && (
                  <>
                    <SubToggle open={open} done={subsDone} total={total} label={`${subsDone} із ${total}`}
                      onClick={() => setOverrides({ ...overrides, [s.id]: !open })} />
                    <Collapse open={open}>
                      <ul className="subs">
                        {s.substeps.map((x, k) => {
                          const on = doneSubs.has(x.id);
                          const flowIn = s.substeps.slice(0, k + 1).every((y) => doneSubs.has(y.id));
                          const flowOut = s.substeps.slice(0, k + 2).every((y) => doneSubs.has(y.id));
                          return (
                            <li key={x.id} className={`sub ${on ? 'is-done' : ''}`} style={{ '--i': Math.min(k, 8) }}>
                              <i className={`sub-line sub-line-in ${flowIn ? 'is-on' : ''}`} />
                              {k < total - 1 && <i className={`sub-line sub-line-out ${flowOut ? 'is-on' : ''}`} />}
                              <Checkbox checked={on} readOnly={!canMark} onChange={(v) => {
                                // Остання галочка закриває етап, але список не має згортатися під рукою.
                                setOverrides((cur) => ({ ...cur, [s.id]: true }));
                                onToggleSub(x, v);
                              }}>{x.title}</Checkbox>
                            </li>
                          );
                        })}
                      </ul>
                    </Collapse>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={finishRef} className={`road-finish ${steps.length % 2 ? 'is-right' : 'is-left'} ${allDone ? 'is-done' : ''}`}
        style={mobile ? { paddingLeft: geo.x[steps.length % 2] - geo.radius } : undefined}>
        <span className="road-flag"><IconFlag size={mobile ? 20 : 28} /></span>
        <span className="road-finish-text">{allDone ? 'Курс пройдено!' : 'Фініш'}</span>
      </div>
    </div>
  );
}

export default function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: course, loading, error, reload } = useData(`/courses/${id}`);
  const [studentId, setStudentId] = useState(null);
  const [mode, setMode] = useState('view');
  const [editCourse, setEditCourse] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [isleEdit, setIsleEdit] = useState(null);
  const [run] = useAction();
  const { confirm, toast } = useUI();

  const isStudent = user.role === 'student';
  const isManager = user.role === 'manager';
  const viewerId = isStudent ? user.id : studentId;

  // Обраний учень міг зникнути з курсу: тоді показуємо першого зі списку.
  useEffect(() => {
    if (!course?.students) return;
    if (!course.students.some((s) => s.id === studentId)) setStudentId(course.students[0]?.id ?? null);
  }, [course, studentId]);

  if (error) return <ErrorNote text={error} onRetry={reload} />;
  if (!course) return loading ? <Loader /> : null;

  const doneIds = new Set(course.progress.filter((p) => p.student_id === viewerId).map((p) => p.step_id));
  const doneSubs = new Set(course.sub_progress.filter((p) => p.student_id === viewerId).map((p) => p.substep_id));

  const toggleStep = async (step, done, subsDone) => {
    if (!done && subsDone > 0) {
      const yes = await confirm({ title: `Зняти позначку з «${step.title}»?`, text: 'Позначки всіх підпунктів цього етапу теж зникнуть.', action: 'Зняти', danger: true });
      if (!yes) return;
    }
    if (await run(() => api(`/courses/${id}/progress`, { method: 'PUT', body: { student_id: studentId, step_id: step.id, done } }))) reload();
  };
  const toggleSub = async (sub, done) => {
    if (await run(() => api(`/courses/${id}/substep-progress`, { method: 'PUT', body: { student_id: studentId, substep_id: sub.id, done } }))) reload();
  };
  // Острівець тестує попередній етап: його тему й копіюємо. Для першого етапу — його самого.
  const copyFor = async (kind, i) => {
    const k = i > 0 ? i - 1 : 0;
    const topic = topicText(course.steps[k], k + 1);
    const text = kind === 'prompt' ? `${QUIZ_PROMPT}${topic}\n` : topic;
    try {
      await navigator.clipboard.writeText(text);
      toast(kind === 'prompt' ? 'Промпт із темою скопійовано' : `Тему етапу ${k + 1} скопійовано`);
    } catch {
      toast('Не вдалося скопіювати. Дозвольте доступ до буфера обміну', 'error');
    }
  };
  const isle = {
    canEdit: course.can_edit,
    staff: !isStudent,
    copy: copyFor,
    edit: (step, i) => setIsleEdit({ step, i, island: course.islands.find((x) => x.step_id === step.id) ?? null }),
    open: async (step, island) => {
      if (isStudent) {
        const r = await run(() => api(`/courses/${id}/islands/${step.id}/start`, { method: 'POST' }));
        if (r) navigate(`/tests/${r.id}`);
      } else if (course.can_edit) {
        setIsleEdit({ step, i: course.steps.indexOf(step), island });
      } else if (isManager) {
        navigate(`/quizzes/${island.quiz_id}`);
      }
    },
  };

  const removeCourse = async () => {
    const yes = await confirm({ title: `Видалити курс «${course.title}»?`, text: 'Роадмап і прогрес учнів зникнуть.', action: 'Видалити', danger: true });
    if (yes && (await run(() => api(`/courses/${id}`, { method: 'DELETE' }), 'Курс видалено'))) navigate('/courses');
  };

  return (
    // Тема курсу перефарбовує акценти сторінки: дорогу, кружки етапів, кнопки.
    <div className={`course-page ${themeClass(course.theme)}`}>
      <Link to="/courses" className="back"><IconLeft size={18} /> Курси</Link>
      <PageHead title={<span className="course-title"><CourseIcon course={course} size={26} big />{course.title}</span>}>
        {isManager && <Button variant="ghost" icon={<IconPeople size={18} />} onClick={() => setPeopleOpen(true)}>Учні курсу: {course.students.length}</Button>}
        {course.can_edit && <Button variant="ghost" icon={<IconSpark size={18} />} onClick={() => setAiOpen(true)}>Роадмап зі ШІ</Button>}
        {course.can_edit && <Button variant={mode === 'edit' ? 'primary' : 'ghost'} icon={<IconRoadmap size={18} />} onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>{mode === 'edit' ? 'Готово' : 'Редагувати роадмап'}</Button>}
        {isManager && <IconButton label="Редагувати курс" onClick={() => setEditCourse(true)}><IconEdit size={20} /></IconButton>}
        {isManager && <IconButton label="Видалити курс" onClick={removeCourse}><IconTrash size={20} /></IconButton>}
      </PageHead>
      {course.summary && <p className="muted lead"><Linkify text={course.summary} /></p>}

      {mode === 'edit' ? (
        <RoadmapEditor course={course} onChange={reload} />
      ) : (
        <>
          {!isStudent && course.students.length > 0 && course.steps.length > 0 && (
            <div className="road-toolbar">
              <Select compact label="Прогрес учня" value={studentId} onChange={setStudentId}
                options={course.students.map((s) => ({ value: s.id, label: s.name, icon: <Avatar user={s} size={22} />, hint: s.direct && !s.from_schedule ? 'на курсі без розкладу' : undefined }))} />
              {course.can_edit && <p className="muted small">Натисніть на етап або підпункт, щоб позначити.</p>}
            </div>
          )}
          {!isStudent && !course.students.length && (
            <p className="muted small road-note">
              На курсі ще немає учнів. {isManager
                ? <button type="button" className="link-btn" onClick={() => setPeopleOpen(true)}>Додайте учня</button>
                : 'Їх додає менеджер або розклад.'}
            </p>
          )}
          {course.steps.length > 0 && viewerId && (
            <ProgressCard steps={course.steps} doneIds={doneIds} doneSubs={doneSubs} viewerId={viewerId} isStudent={isStudent}
              homework={course.homework.filter((h) => h.student_ids.includes(viewerId))} />
          )}
          {!course.steps.length ? (
            <Empty icon={<IconRoadmap size={36} />} title="Роадмап ще порожній"
              action={course.can_edit ? <Button icon={<IconPlus size={18} />} onClick={() => setMode('edit')}>Додати етапи</Button> : null} />
          ) : (
            <RoadmapPath key={viewerId ?? 'none'} steps={course.steps} doneIds={doneIds} doneSubs={doneSubs} canMark={course.can_edit && Boolean(studentId)}
              onToggleStep={toggleStep} onToggleSub={toggleSub} viewerId={viewerId}
              homework={viewerId ? course.homework.filter((h) => h.student_ids.includes(viewerId)) : course.homework}
              quizzes={course.quizzes.filter((z) => z.student_id === viewerId)} quizLinks={isStudent || isManager}
              islands={course.islands} isle={isle} />
          )}
        </>
      )}
      {editCourse && <CourseForm course={course} onClose={() => setEditCourse(false)} onDone={() => { setEditCourse(false); reload(); }} />}
      {aiOpen && <RoadmapAi course={course} onClose={() => setAiOpen(false)} onDone={() => { setAiOpen(false); setMode('view'); reload(); }} />}
      {isleEdit && <IslandForm course={course} step={isleEdit.step} island={isleEdit.island} isManager={isManager}
        sourceText={(kind) => copyFor(kind, isleEdit.i)} onClose={() => setIsleEdit(null)} onDone={() => { setIsleEdit(null); reload(); }} />}
      {peopleOpen && <CourseStudents course={course} onClose={() => setPeopleOpen(false)} onChange={reload} />}
    </div>
  );
}

/**
 * Учні курсу. Напряму доданих менеджер прибирає тут; учні з розкладу лишаються, доки стоять у розкладі.
 * Закріплений вчитель бачить курс і веде прогрес учня.
 */
function CourseStudents({ course, onClose, onChange }) {
  const people = useData('/users');
  const [studentId, setStudentId] = useState(null);
  const [teacherId, setTeacherId] = useState(null);
  const [run, busy] = useAction();
  const { confirm } = useUI();
  const list = people.data ?? [];
  const teachers = list.filter((u) => u.role === 'teacher' && u.is_active).map((u) => ({ value: u.id, label: u.name }));
  const direct = new Set(course.students.filter((s) => s.direct).map((s) => s.id));
  const pupils = list.filter((u) => u.role === 'student' && u.is_active && !direct.has(u.id)).map((u) => ({ value: u.id, label: u.name }));

  const add = async (e) => {
    e.preventDefault();
    const ok = await run(() => api(`/courses/${course.id}/students`, { method: 'POST', body: { student_id: studentId, teacher_id: teacherId } }), 'Учня додано на курс');
    if (ok) { setStudentId(null); onChange(); }
  };
  const setTeacher = async (s, value) => {
    if (await run(() => api(`/courses/${course.id}/students/${s.id}`, { method: 'PATCH', body: { teacher_id: value } }), 'Вчителя змінено')) onChange();
  };
  const remove = async (s) => {
    const yes = await confirm({
      title: `Прибрати ${s.name} з курсу?`,
      text: s.from_schedule ? 'Учень лишиться на курсі через розклад.' : 'Позначки прогресу збережуться, якщо учня повернуть.',
      action: 'Прибрати', danger: true,
    });
    if (yes && (await run(() => api(`/courses/${course.id}/students/${s.id}`, { method: 'DELETE' }), 'Учня прибрано з курсу'))) onChange();
  };

  return (
    <Modal side title="Учні курсу" onClose={onClose}>
      <div className="sheet">
        <form className="form course-add" onSubmit={add}>
          <Select label="Учень" value={studentId} onChange={setStudentId} placeholder="Оберіть учня" options={pupils} />
          <Select label="Вчитель" hint="Необов'язково. Бачить курс і позначає прогрес" value={teacherId} onChange={setTeacherId}
            placeholder="Без вчителя" clearable options={teachers} />
          <Button type="submit" busy={busy} disabled={!studentId} icon={<IconPlus size={18} />}>Додати на курс</Button>
        </form>
        {course.students.length ? (
          <ul className="rows course-people">
            {course.students.map((s) => (
              <li key={s.id} className="row">
                <div className="row-main">
                  <h3><Who name={s.name} avatar={s.avatar} size={30} /></h3>
                  <p className="muted small">{[s.direct && 'доданий напряму', s.from_schedule && 'з розкладу'].filter(Boolean).join(' · ')}</p>
                  {s.direct && (
                    <Select compact label="Вчитель" value={s.teacher_id} placeholder="Без вчителя" clearable options={teachers}
                      onChange={(v) => setTeacher(s, v)} />
                  )}
                </div>
                {s.direct && <IconButton label={`Прибрати ${s.name} з курсу`} onClick={() => remove(s)}><IconTrash size={18} /></IconButton>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Учнів поки немає.</p>
        )}
      </div>
    </Modal>
  );
}

function RoadmapEditor({ course, onChange }) {
  const [steps, setSteps] = useState(course.steps);
  const [editing, setEditing] = useState(null);
  const [opened, setOpened] = useState({});
  const [run] = useAction();
  const { confirm } = useUI();
  useEffect(() => setSteps(course.steps), [course.steps]);

  const move = async (i, delta) => {
    const next = [...steps];
    const [item] = next.splice(i, 1);
    next.splice(i + delta, 0, item);
    setSteps(next);
    await run(() => api(`/courses/${course.id}/steps-order`, { method: 'PUT', body: { ids: next.map((s) => s.id) } }));
    onChange();
  };
  const remove = async (s) => {
    const yes = await confirm({ title: `Видалити етап «${s.title}»?`, text: 'Його підпункти й позначки учнів теж зникнуть.', action: 'Видалити', danger: true });
    if (yes && (await run(() => api(`/courses/${course.id}/steps/${s.id}`, { method: 'DELETE' }), 'Етап видалено'))) onChange();
  };

  return (
    <div className="road-editor">
      <ol className="rows">
        {steps.map((s, i) => {
          const open = Boolean(opened[s.id]);
          return (
            <li key={s.id} className="step-edit">
              <div className="row">
                <span className="step-num">{i + 1}</span>
                <div className="row-main">
                  <h3>{s.title}</h3>
                  {s.description && <p className="muted small">{s.description}</p>}
                  <SubToggle open={open} total={s.substeps.length} label={`Підпункти: ${s.substeps.length}`}
                    onClick={() => setOpened({ ...opened, [s.id]: !open })} />
                </div>
                <div className="row-actions">
                  <IconButton label="Вище" disabled={i === 0} onClick={() => move(i, -1)}><IconUp size={18} /></IconButton>
                  <IconButton label="Нижче" disabled={i === steps.length - 1} onClick={() => move(i, 1)}><IconDown size={18} /></IconButton>
                  <IconButton label="Редагувати етап" onClick={() => setEditing(s)}><IconEdit size={18} /></IconButton>
                  <IconButton label="Видалити етап" onClick={() => remove(s)}><IconTrash size={18} /></IconButton>
                </div>
              </div>
              <Collapse open={open}>
                <SubstepEditor courseId={course.id} step={s} onChange={onChange} />
              </Collapse>
            </li>
          );
        })}
      </ol>
      <Button variant="ghost" icon={<IconPlus size={18} />} onClick={() => setEditing({})}>Додати етап</Button>
      {editing && <StepForm courseId={course.id} step={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); onChange(); }} />}
    </div>
  );
}

function SubstepEditor({ courseId, step, onChange }) {
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(null);
  const [run, busy] = useAction();
  const { confirm } = useUI();
  const subs = step.substeps;

  const add = async (e) => {
    e.preventDefault();
    if (await run(() => api(`/courses/${courseId}/steps/${step.id}/substeps`, { method: 'POST', body: { title } }))) {
      setTitle('');
      onChange();
    }
  };
  const move = async (k, delta) => {
    const ids = subs.map((s) => s.id);
    const [item] = ids.splice(k, 1);
    ids.splice(k + delta, 0, item);
    if (await run(() => api(`/courses/${courseId}/steps/${step.id}/substeps-order`, { method: 'PUT', body: { ids } }))) onChange();
  };
  const remove = async (s) => {
    const yes = await confirm({ title: `Видалити підпункт «${s.title}»?`, text: 'Позначки учнів на ньому теж зникнуть.', action: 'Видалити', danger: true });
    if (yes && (await run(() => api(`/courses/${courseId}/substeps/${s.id}`, { method: 'DELETE' }), 'Підпункт видалено'))) onChange();
  };

  return (
    <div className="sub-edit">
      {subs.length > 0 && (
        <ul>
          {subs.map((s, k) => (
            <li key={s.id} className="sub-edit-row">
              <span className="sub-edit-title">{s.title}</span>
              <div className="row-actions">
                <IconButton label="Вище" disabled={k === 0} onClick={() => move(k, -1)}><IconUp size={16} /></IconButton>
                <IconButton label="Нижче" disabled={k === subs.length - 1} onClick={() => move(k, 1)}><IconDown size={16} /></IconButton>
                <IconButton label="Редагувати підпункт" onClick={() => setEditing(s)}><IconEdit size={16} /></IconButton>
                <IconButton label="Видалити підпункт" onClick={() => remove(s)}><IconTrash size={16} /></IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="sub-add" onSubmit={add}>
        <input className="input" placeholder="Новий підпункт" aria-label={`Новий підпункт етапу «${step.title}»`} maxLength={160}
          value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit" small busy={busy} disabled={!title.trim()} icon={<IconPlus size={16} />}>Додати</Button>
      </form>
      {editing && <SubstepForm courseId={courseId} sub={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); onChange(); }} />}
    </div>
  );
}

function SubstepForm({ courseId, sub, onClose, onDone }) {
  const [title, setTitle] = useState(sub.title);
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    if (await run(() => api(`/courses/${courseId}/substeps/${sub.id}`, { method: 'PATCH', body: { title } }), 'Зміни збережено')) onDone();
  };
  return (
    <Modal narrow title="Редагувати підпункт" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Input label="Назва" required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy}>Зберегти</Button>
        </div>
      </form>
    </Modal>
  );
}

function StepForm({ courseId, step, onClose, onDone }) {
  const isNew = !step.id;
  const [title, setTitle] = useState(step.title ?? '');
  const [description, setDescription] = useState(step.description ?? '');
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(
      () => api(isNew ? `/courses/${courseId}/steps` : `/courses/${courseId}/steps/${step.id}`, { method: isNew ? 'POST' : 'PATCH', body: { title, description } }),
      isNew ? 'Етап додано' : 'Зміни збережено'
    );
    if (ok) onDone();
  };
  return (
    <Modal narrow title={isNew ? 'Новий етап' : 'Редагувати етап'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Input label="Назва" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Опис" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy}>{isNew ? 'Додати' : 'Зберегти'}</Button>
        </div>
      </form>
    </Modal>
  );
}
