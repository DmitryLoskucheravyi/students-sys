import { useState } from 'react';
import { api, useData } from '../api.js';
import { useAuth } from '../session.jsx';
import { Button, Empty, ErrorNote, IconButton, Input, Linkify, Loader, Modal, PageTools, Select, Stepper, Textarea, useAction, useUI } from '../ui.jsx';
import { IconArchive, IconCalendar, IconEdit, IconLesson, IconPlus, IconRestore } from '../icons.jsx';
import { ScheduleForm } from './Schedule.jsx';

/* Уроки — шаблони: назва, курс, тривалість, місце. Хто, з ким і коли — задається в розкладі. */
export default function Lessons() {
  const { user } = useAuth();
  const isManager = user.role === 'manager';
  const { data, loading, error, reload } = useData('/lessons');
  const [editing, setEditing] = useState(null);
  const [scheduling, setScheduling] = useState(null);
  const [run] = useAction();
  const { confirm } = useUI();

  const archive = async (l) => {
    const yes = await confirm({ title: `Архівувати «${l.title}»?`, text: 'Майбутні заняття зникнуть із розкладу. Історія збережеться.', action: 'Архівувати', danger: true });
    if (yes && (await run(() => api(`/lessons/${l.id}/archive`, { method: 'POST' }), 'Урок в архіві'))) reload();
  };
  const restore = async (l) => {
    if (await run(() => api(`/lessons/${l.id}/restore`, { method: 'POST' }), 'Урок повернуто')) reload();
  };

  const active = (data ?? []).filter((l) => l.is_active);
  const archived = (data ?? []).filter((l) => !l.is_active);
  const meta = (l) => [l.course_title, `${l.duration_min} хв`, l.default_teacher_name].filter(Boolean).join(', ');

  return (
    <>
      <PageTools title="Уроки">
        {isManager && <Button icon={<IconPlus size={18} />} onClick={() => setEditing({})}>Новий урок</Button>}
      </PageTools>
      {error && <ErrorNote text={error} onRetry={reload} />}
      {!data && loading && <Loader />}
      {data && !active.length && !archived.length && (
        <Empty icon={<IconLesson size={36} />} title={isManager ? 'Створіть перший урок' : 'Вам ще не призначили уроків'} />
      )}
      {active.length > 0 && (
        <ul className="rows">
          {active.map((l) => (
            <li key={l.id} className="row lesson-row">
              <div className="row-main">
                <h3>{l.title}</h3>
                <p className="muted small">{meta(l)}</p>
                {l.location && <p className="small"><Linkify text={l.location} /></p>}
              </div>
              {isManager && (
                <div className="row-actions">
                  <Button variant="ghost" small icon={<IconCalendar size={16} />} onClick={() => setScheduling(l)}>В розклад</Button>
                  <IconButton label="Редагувати" onClick={() => setEditing(l)}><IconEdit size={20} /></IconButton>
                  <IconButton label="Архівувати" onClick={() => archive(l)}><IconArchive size={20} /></IconButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {archived.length > 0 && (
        <details className="archive">
          <summary>Архів, {archived.length}</summary>
          <ul className="rows">
            {archived.map((l) => (
              <li key={l.id} className="row">
                <div className="row-main">
                  <h3>{l.title}</h3>
                  <p className="muted small">{meta(l)}</p>
                </div>
                {isManager && <Button variant="ghost" small icon={<IconRestore size={16} />} onClick={() => restore(l)}>Повернути</Button>}
              </li>
            ))}
          </ul>
        </details>
      )}
      {editing && <LessonForm lesson={editing} onClose={() => setEditing(null)} onDone={(created) => {
        setEditing(null);
        reload();
        if (created) setScheduling(created);
      }} />}
      {scheduling && <ScheduleForm preset={{ lessonId: scheduling.id }} onClose={() => setScheduling(null)} onDone={() => { setScheduling(null); reload(); }} />}
    </>
  );
}

function LessonForm({ lesson, onClose, onDone }) {
  const isNew = !lesson.id;
  const courses = useData('/courses');
  const people = useData('/users?role=teacher');
  const [title, setTitle] = useState(lesson.title ?? '');
  const [courseId, setCourseId] = useState(lesson.course_id ?? null);
  const [teacherId, setTeacherId] = useState(lesson.default_teacher_id ?? null);
  const teachers = (people.data ?? []).filter((u) => u.is_active || u.id === lesson.default_teacher_id).map((u) => ({ value: u.id, label: u.name }));
  const [duration, setDuration] = useState(lesson.duration_min ?? 60);
  const [location, setLocation] = useState(lesson.location ?? '');
  const [note, setNote] = useState(lesson.note ?? '');
  const [run, busy] = useAction();

  const submit = async (e) => {
    e.preventDefault();
    const body = { title, course_id: courseId, default_teacher_id: teacherId, duration_min: Number(duration), location, note };
    const r = await run(() => api(isNew ? '/lessons' : `/lessons/${lesson.id}`, { method: isNew ? 'POST' : 'PATCH', body }), isNew ? 'Урок створено' : 'Зміни збережено');
    if (r) onDone(isNew ? r : null);
  };

  return (
    <Modal title={isNew ? 'Новий урок' : 'Редагувати урок'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Input label="Назва" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="form-row">
          <Select label="Курс" value={courseId} onChange={setCourseId} clearable="Без курсу" placeholder="Без курсу"
            options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))} />
          <Select label="Вчитель за замовчуванням" value={teacherId} onChange={setTeacherId} clearable="Не вказано" placeholder="Не вказано" options={teachers} />
        </div>
        <div className="form-row">
          <Stepper label="Тривалість" suffix="хв" value={duration} onChange={setDuration} min={10} max={480} step={15} />
          <Input label="Місце" placeholder="Кабінет або посилання" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <Textarea label="Нотатка" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        {isNew && <p className="muted small">Учнів і час обираєте, коли ставите урок у розклад. Вчитель підставиться звідси, його можна змінити.</p>}
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy}>{isNew ? 'Створити' : 'Зберегти'}</Button>
        </div>
      </form>
    </Modal>
  );
}
