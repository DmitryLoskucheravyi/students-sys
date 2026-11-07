import { useState } from 'react';
import { api, useData } from '../api.js';
import { useAuth } from '../session.jsx';
import { Button, Empty, ErrorNote, IconButton, Input, Loader, Modal, PageHead, Select, Stepper, Textarea, useAction, useUI } from '../ui.jsx';
import { IconArchive, IconCalendar, IconClose, IconEdit, IconLesson, IconOnce, IconPeople, IconPlus, IconRepeat, IconRestore, IconUser } from '../icons.jsx';
import { WEEKDAYS, shortDate, studentsWord } from '../fmt.js';
import { ScheduleForm } from './Schedule.jsx';

export default function Lessons() {
  const { user } = useAuth();
  const isManager = user.role === 'manager';
  const { data, loading, error, reload } = useData('/lessons');
  const [editing, setEditing] = useState(null);
  const [scheduling, setScheduling] = useState(null);
  const [staffing, setStaffing] = useState(null);
  const [run] = useAction();
  const { confirm } = useUI();

  const archive = async (l) => {
    const yes = await confirm({ title: `Архівувати «${l.title}»?`, text: 'Майбутні заняття зникнуть із розкладу. Історія збережеться.', action: 'Архівувати', danger: true });
    if (yes && (await run(() => api(`/lessons/${l.id}/archive`, { method: 'POST' }), 'Урок в архіві'))) reload();
  };
  const restore = async (l) => {
    if (await run(() => api(`/lessons/${l.id}/restore`, { method: 'POST' }), 'Урок повернуто')) reload();
  };
  const stop = async (l, s) => {
    const yes = await confirm({ title: 'Прибрати з розкладу?', text: `Майбутні заняття «${l.title}» за цим правилом зникнуть.`, action: 'Прибрати', danger: true });
    if (yes && (await run(() => api(`/schedules/${s.id}`, { method: 'DELETE' }), 'Прибрано з розкладу'))) reload();
  };

  const active = (data ?? []).filter((l) => l.is_active);
  const archived = (data ?? []).filter((l) => !l.is_active);

  return (
    <>
      <PageHead title="Уроки">
        {isManager && <Button icon={<IconPlus size={18} />} onClick={() => setEditing({})}>Новий урок</Button>}
      </PageHead>
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
                <p className="muted small">
                  {[l.course_title, `${l.duration_min} хв`, l.location].filter(Boolean).join(', ')}
                </p>
                <p className="small lesson-people">
                  <span title="Вчитель"><IconUser size={16} />{l.teacher_name ? l.teacher_name : <span className="text-red">Без вчителя</span>}</span>
                  <span title="Учні"><IconPeople size={16} />{l.students.length ? l.students.map((s) => s.name).join(', ') : <span className="muted">Без учнів</span>}</span>
                </p>
              </div>
              <div className="slot-list">
                {l.schedules.map((s) => (
                  <span key={s.id} className={`slot slot-${s.kind}`}>
                    {s.kind === 'weekly' ? <IconRepeat size={15} /> : <IconOnce size={15} />}
                    {s.kind === 'weekly' ? `${WEEKDAYS[s.weekday - 1]} ${s.time}` : `${shortDate(s.start_date)} ${s.time}`}
                    {isManager && (
                      <button type="button" aria-label="Прибрати з розкладу" title="Прибрати з розкладу" onClick={() => stop(l, s)}><IconClose size={14} /></button>
                    )}
                  </span>
                ))}
                {!l.schedules.length && <span className="muted small">Не в розкладі</span>}
              </div>
              {isManager && (
                <div className="row-actions">
                  <Button variant="ghost" small icon={<IconPeople size={16} />} onClick={() => setStaffing(l)}>Склад</Button>
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
                  <p className="muted small">{l.teacher_name ?? 'Без вчителя'}, {studentsWord(l.students.length)}</p>
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
        if (created) setStaffing(created);
      }} />}
      {staffing && <PeopleForm lesson={staffing} onClose={() => setStaffing(null)} onDone={() => { setStaffing(null); reload(); }} />}
      {scheduling && <ScheduleForm preset={{ lessonId: scheduling.id }} onClose={() => setScheduling(null)} onDone={() => { setScheduling(null); reload(); }} />}
    </>
  );
}

/* Урок — окрема сутність: назва, курс, тривалість. Вчитель і учні додаються окремо, у «Складі». */
function LessonForm({ lesson, onClose, onDone }) {
  const isNew = !lesson.id;
  const courses = useData('/courses');
  const [title, setTitle] = useState(lesson.title ?? '');
  const [courseId, setCourseId] = useState(lesson.course_id ?? null);
  const [duration, setDuration] = useState(lesson.duration_min ?? 60);
  const [location, setLocation] = useState(lesson.location ?? '');
  const [note, setNote] = useState(lesson.note ?? '');
  const [run, busy] = useAction();

  const submit = async (e) => {
    e.preventDefault();
    const body = { title, course_id: courseId, duration_min: Number(duration), location, note };
    const r = await run(() => api(isNew ? '/lessons' : `/lessons/${lesson.id}`, { method: isNew ? 'POST' : 'PATCH', body }), isNew ? 'Урок створено' : 'Зміни збережено');
    if (r) onDone(isNew ? r : null);
  };

  return (
    <Modal title={isNew ? 'Новий урок' : 'Редагувати урок'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Input label="Назва" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Select label="Курс" value={courseId} onChange={setCourseId} clearable="Без курсу" placeholder="Без курсу"
          options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))} />
        <div className="form-row">
          <Stepper label="Тривалість" suffix="хв" value={duration} onChange={setDuration} min={10} max={480} step={15} />
          <Input label="Місце" placeholder="Кабінет або посилання" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <Textarea label="Нотатка" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        {isNew && <p className="muted small">Вчителя й учнів додасте одразу після створення.</p>}
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy}>{isNew ? 'Створити' : 'Зберегти'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function PeopleForm({ lesson, onClose, onDone }) {
  const people = useData('/users');
  const [teacherId, setTeacherId] = useState(lesson.teacher_id ?? null);
  const [students, setStudents] = useState(lesson.students?.map((s) => s.id) ?? []);
  const [run, busy] = useAction();

  const list = people.data ?? [];
  // Вимкнених, які вже в уроці, теж показуємо: інакше їх не прибрати зі складу.
  const inLesson = new Set(lesson.students?.map((s) => s.id));
  const label = (u) => (u.is_active ? u.name : `${u.name} (вимкнений)`);
  const teachers = list.filter((u) => u.role === 'teacher' && (u.is_active || u.id === lesson.teacher_id)).map((u) => ({ value: u.id, label: label(u) }));
  const pupils = list.filter((u) => u.role === 'student' && (u.is_active || inLesson.has(u.id))).map((u) => ({ value: u.id, label: label(u) }));

  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(() => api(`/lessons/${lesson.id}`, { method: 'PATCH', body: { teacher_id: teacherId, student_ids: students } }), 'Склад збережено');
    if (ok) onDone();
  };

  return (
    <Modal title={`Склад: ${lesson.title}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Select label="Вчитель" value={teacherId} onChange={setTeacherId} clearable="Без вчителя" placeholder="Без вчителя" options={teachers} />
        <Select label="Учні" multiple value={students} onChange={setStudents} options={pupils} placeholder="Оберіть учнів" />
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Пізніше</Button>
          <Button type="submit" busy={busy}>Зберегти</Button>
        </div>
      </form>
    </Modal>
  );
}
