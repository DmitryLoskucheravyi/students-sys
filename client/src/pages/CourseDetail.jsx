import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useData } from '../api.js';
import { useAuth, useIsMobile } from '../session.jsx';
import { Button, Checkbox, Collapse, Empty, ErrorNote, IconButton, Input, Loader, Modal, PageHead, Select, useAction, useUI } from '../ui.jsx';
import { IconDown, IconEdit, IconLeft, IconPlus, IconRoadmap, IconSpark, IconTick, IconTrash, IconUp } from '../icons.jsx';
import { CourseForm } from './Courses.jsx';
import RoadmapAi from './RoadmapAi.jsx';

/** Центр кружка від верху рядка; має збігатися з .stop у styles.css. */
const STOP_CENTER = 30;
const STOP_RADIUS = 22;
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
function RoadmapPath({ steps, doneIds, doneSubs, canMark, onToggleStep, onToggleSub }) {
  const mobile = useIsMobile();
  const X = mobile ? [22, 56] : [36, 92];
  const listRef = useRef(null);
  const [ys, setYs] = useState([]);
  const [overrides, setOverrides] = useState({});

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    const measure = () => setYs([...el.children].map((row) => row.offsetTop + STOP_CENTER));
    measure();
    // Спрацьовує щокадру під час розгортання, тому лінія рухається разом із рядками.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [steps.length]);

  const firstOpen = steps.findIndex((s) => !doneIds.has(s.id));
  const px = (i) => X[i % 2];
  const segments = ys.length === steps.length
    ? steps.slice(0, -1).map((s, i) => {
        const [x0, y0, x1, y1] = [px(i), ys[i], px(i + 1), ys[i + 1]];
        const mid = (y1 - y0) / 2;
        return {
          id: s.id,
          d: `M${x0} ${y0} C${x0} ${y0 + mid}, ${x1} ${y1 - mid}, ${x1} ${y1}`,
          done: doneIds.has(s.id) && doneIds.has(steps[i + 1].id),
        };
      })
    : [];

  return (
    <div className="road">
      <svg className="road-line" width="100%" height="100%" aria-hidden="true">
        {segments.map((s) => (
          <g key={s.id}>
            <path d={s.d} className="road-todo" />
            <path d={s.d} pathLength="1" className={`road-done ${s.done ? 'is-done' : ''}`} />
          </g>
        ))}
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
  const [run] = useAction();
  const { confirm } = useUI();

  const isStudent = user.role === 'student';
  const isManager = user.role === 'manager';
  const viewerId = isStudent ? user.id : studentId;

  useEffect(() => {
    if (course?.students?.length && !studentId) setStudentId(course.students[0].id);
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
    <>
      <Link to="/courses" className="back"><IconLeft size={18} /> Курси</Link>
      <PageHead title={course.title}>
        {course.can_edit && <Button variant="ghost" icon={<IconSpark size={18} />} onClick={() => setAiOpen(true)}>Роадмап зі ШІ</Button>}
        {course.can_edit && <Button variant={mode === 'edit' ? 'primary' : 'ghost'} icon={<IconRoadmap size={18} />} onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>{mode === 'edit' ? 'Готово' : 'Редагувати роадмап'}</Button>}
        {isManager && <IconButton label="Редагувати курс" onClick={() => setEditCourse(true)}><IconEdit size={20} /></IconButton>}
        {isManager && <IconButton label="Видалити курс" onClick={removeCourse}><IconTrash size={20} /></IconButton>}
      </PageHead>
      {course.summary && <p className="muted lead">{course.summary}</p>}

      {mode === 'edit' ? (
        <RoadmapEditor course={course} onChange={reload} />
      ) : (
        <>
          {!isStudent && course.students.length > 0 && course.steps.length > 0 && (
            <div className="road-toolbar">
              <Select compact label="Прогрес учня" value={studentId} onChange={setStudentId} options={course.students.map((s) => ({ value: s.id, label: s.name }))} />
              {course.can_edit && <p className="muted small">Натисніть на етап або підпункт, щоб позначити.</p>}
            </div>
          )}
          {!course.steps.length ? (
            <Empty icon={<IconRoadmap size={36} />} title="Роадмап ще порожній"
              action={course.can_edit ? <Button icon={<IconPlus size={18} />} onClick={() => setMode('edit')}>Додати етапи</Button> : null} />
          ) : (
            <RoadmapPath key={viewerId ?? 'none'} steps={course.steps} doneIds={doneIds} doneSubs={doneSubs} canMark={course.can_edit && Boolean(studentId)}
              onToggleStep={toggleStep} onToggleSub={toggleSub} />
          )}
        </>
      )}
      {editCourse && <CourseForm course={course} onClose={() => setEditCourse(false)} onDone={() => { setEditCourse(false); reload(); }} />}
      {aiOpen && <RoadmapAi course={course} onClose={() => setAiOpen(false)} onDone={() => { setAiOpen(false); setMode('view'); reload(); }} />}
    </>
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
