import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useData } from '../api.js';
import { useAuth, useIsMobile } from '../session.jsx';
import { Button, Checkbox, Collapse, Empty, ErrorNote, IconButton, Input, Linkify, Loader, Modal, PageHead, Select, Status, useAction, useUI } from '../ui.jsx';
import { IconDown, IconEdit, IconHomework, IconLeft, IconPeople, IconPlus, IconQuiz, IconRight, IconRoadmap, IconSpark, IconTick, IconTrash, IconUp } from '../icons.jsx';
import { dateTimeShort, nowLocal, plural } from '../fmt.js';
import { CourseForm } from './Courses.jsx';
import { HW_STATUS } from './Homework.jsx';
import RoadmapAi from './RoadmapAi.jsx';
import { CourseIcon, themeClass } from '../courseLook.jsx';

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

/** Геометрія дороги. Центр і радіус кружка мають збігатися з .stop у styles.css. */
const ROAD = {
  mobile: { x: [26, 74], center: 30, radius: 22 },
  wide: { x: [70, 310], center: 34, radius: 28 },
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

/** Звивиста дорога. Висота рядків залежить від підпунктів, тому точки вимірюємо з DOM. */
function RoadmapPath({ steps, doneIds, doneSubs, canMark, onToggleStep, onToggleSub, homework = [], quizzes = [], quizLinks = false, viewerId = null }) {
  const mobile = useIsMobile();
  const { x: X, center: STOP_CENTER, radius: STOP_RADIUS } = mobile ? ROAD.mobile : ROAD.wide;
  const listRef = useRef(null);
  const [ys, setYs] = useState([]);
  const [overrides, setOverrides] = useState({});

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    const measure = () => setYs([...el.children].map((row) => row.offsetTop + STOP_CENTER));
    measure();
    // Спрацьовує щокадру під час розгортання, тому дорога рухається разом із рядками.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [steps.length, STOP_CENTER]);

  const firstOpen = steps.findIndex((s) => !doneIds.has(s.id));
  const px = (i) => X[i % 2];
  const curve = (x0, y0, x1, y1) => {
    const mid = (y1 - y0) / 2;
    return `M${x0} ${y0} C${x0} ${y0 + mid}, ${x1} ${y1 - mid}, ${x1} ${y1}`;
  };
  const ready = ys.length === steps.length && steps.length > 0;
  const segments = ready
    ? steps.slice(0, -1).map((s, i) => ({
        id: s.id,
        d: curve(px(i), ys[i], px(i + 1), ys[i + 1]),
        done: doneIds.has(s.id) && doneIds.has(steps[i + 1].id),
      }))
    : [];

  return (
    <div className="road" style={{ '--road-text': `${X[1] + STOP_RADIUS + (mobile ? 18 : 40)}px` }}>
      <svg className="road-line" width="100%" height="100%" aria-hidden="true">
        <g className="road-bed">{segments.map((s) => <path key={s.id} d={s.d} />)}</g>
        <g>{segments.map((s) => <path key={s.id} d={s.d} pathLength="1" className={`road-done ${s.done ? 'is-done' : ''}`} />)}</g>
        <g className="road-mark">{segments.map((s) => <path key={s.id} d={s.d} />)}</g>
      </svg>
      <ol ref={listRef} className="road-list">
        {steps.map((s, i) => {
          const done = doneIds.has(s.id);
          const current = i === firstOpen;
          const total = s.substeps.length;
          const subsDone = s.substeps.filter((x) => doneSubs.has(x.id)).length;
          const open = overrides[s.id] ?? current;
          const cls = `stop ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`;
          const left = px(i) - STOP_RADIUS;
          const label = `${s.title}: ${done ? 'пройдено' : total ? `пройдено ${subsDone} із ${total}` : 'не пройдено'}`;
          const inner = (
            <>
              {total > 0 && !done && <StopRing fraction={subsDone / total} />}
              {done ? <IconTick size={20} /> : i + 1}
            </>
          );
          return (
            <li key={s.id} className="road-row">
              {canMark ? (
                <button type="button" className={cls} style={{ left }} aria-pressed={done} aria-label={label}
                  title={done ? 'Зняти позначку' : 'Позначити пройденим'} onClick={() => onToggleStep(s, !done, subsDone)}>{inner}</button>
              ) : (
                <span className={cls} style={{ left }} role="img" aria-label={label}>{inner}</span>
              )}
              <div className="road-text">
                <h3>{s.title}</h3>
                {s.description && <p className="muted small">{s.description}</p>}
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
  const [run] = useAction();
  const { confirm } = useUI();

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
                options={course.students.map((s) => ({ value: s.id, label: s.name, hint: s.direct && !s.from_schedule ? 'на курсі без розкладу' : undefined }))} />
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
              quizzes={course.quizzes.filter((z) => z.student_id === viewerId)} quizLinks={isStudent || isManager} />
          )}
        </>
      )}
      {editCourse && <CourseForm course={course} onClose={() => setEditCourse(false)} onDone={() => { setEditCourse(false); reload(); }} />}
      {aiOpen && <RoadmapAi course={course} onClose={() => setAiOpen(false)} onDone={() => { setAiOpen(false); setMode('view'); reload(); }} />}
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
                  <h3>{s.name}</h3>
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
