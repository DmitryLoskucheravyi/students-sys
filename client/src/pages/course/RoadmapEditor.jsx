/* Редактор роадмапу: етапи, підпункти, порядок. */
import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Button, Collapse, IconButton, Input, Modal, useAction, useUI } from '../../ui.jsx';
import { IconDown, IconEdit, IconPlus, IconTrash, IconUp } from '../../icons.jsx';
import { SubToggle } from './Roadmap.jsx';

export function RoadmapEditor({ course, onChange }) {
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
