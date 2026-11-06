import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useData } from '../api.js';
import { useAuth } from '../session.jsx';
import { Button, DatePicker, Empty, ErrorNote, Input, Loader, Modal, PageHead, Select, Status, Textarea, TimePicker, useAction } from '../ui.jsx';
import { IconHomework, IconPlus } from '../icons.jsx';
import { addDays, dateTimeShort, nowLocal, todayISO } from '../fmt.js';

export const HW_STATUS = {
  todo: ['warn', 'Треба здати'],
  submitted: ['scheduled', 'На перевірці'],
  returned: ['cancelled', 'Повернуто'],
  accepted: ['completed', 'Прийнято'],
};
const GROUPS = [
  ['returned', 'Виправити'],
  ['todo', 'Треба здати'],
  ['submitted', 'На перевірці'],
  ['accepted', 'Прийнято'],
];

export default function Homework() {
  const { user } = useAuth();
  const isStudent = user.role === 'student';
  const { data, loading, error, reload } = useData('/homework');
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const now = nowLocal();

  return (
    <>
      <PageHead title="Домашні">
        {!isStudent && <Button icon={<IconPlus size={18} />} onClick={() => setAdding(true)}>Задати домашнє</Button>}
      </PageHead>
      {error && <ErrorNote text={error} onRetry={reload} />}
      {!data && loading && <Loader />}
      {data && !data.length && <Empty icon={<IconHomework size={36} />} title="Домашніх поки немає" />}

      {isStudent && data && GROUPS.map(([status, title]) => {
        const items = data.filter((h) => h.my_status === status).sort((a, b) => a.due_at.localeCompare(b.due_at));
        if (!items.length) return null;
        return (
          <section key={status} className="hw-group">
            <h2>{title} <span className="count">{items.length}</span></h2>
            <ul className="rows">
              {items.map((h) => {
                const late = status !== 'accepted' && status !== 'submitted' && h.due_at < now;
                return (
                  <li key={h.id}>
                    <Link className="row row-link" to={`/homework/${h.id}`}>
                      <div className="row-main">
                        <h3>{h.title}</h3>
                        <p className="muted small">{h.course_title ?? h.lesson_title}</p>
                      </div>
                      <span className={`small ${late ? 'text-red' : 'muted'}`}>до {dateTimeShort(h.due_at)}</span>
                      {h.my_grade != null ? <span className="grade">{h.my_grade}</span> : <Status kind={HW_STATUS[status][0]}>{HW_STATUS[status][1]}</Status>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {!isStudent && data?.length > 0 && (
        <ul className="rows">
          {data.map((h) => (
            <li key={h.id}>
              <Link className="row row-link" to={`/homework/${h.id}`}>
                <div className="row-main">
                  <h3>{h.title}</h3>
                  <p className="muted small">{h.lesson_title}, {h.teacher_name}</p>
                </div>
                <span className="small muted">до {dateTimeShort(h.due_at)}</span>
                <span className="small">Здали {h.submitted_count} із {h.students_count}</span>
                {h.to_review > 0 && <Status kind="scheduled">Перевірити: {h.to_review}</Status>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {adding && <NewHomework onClose={() => setAdding(false)} onDone={(id) => navigate(`/homework/${id}`)} />}
    </>
  );
}

function NewHomework({ onClose, onDone }) {
  const lessons = useData('/lessons');
  const [lessonId, setLessonId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(addDays(todayISO(), 7));
  const [time, setTime] = useState('23:55');
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const r = await run(() => api('/homework', { method: 'POST', body: { lesson_id: lessonId, title, description, due_at: `${date} ${time}:00` } }), 'Домашнє задано');
    if (r) onDone(r.id);
  };
  return (
    <Modal title="Задати домашнє" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Select label="Урок" value={lessonId} onChange={setLessonId}
          options={(lessons.data ?? []).filter((l) => l.is_active).map((l) => ({ value: l.id, label: l.title, hint: l.teacher_name }))} />
        <Input label="Назва" required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Завдання" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="form-row">
          <DatePicker label="Здати до" value={date} onChange={setDate} />
          <TimePicker label="Час" value={time} onChange={setTime} />
        </div>
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy} disabled={!lessonId}>Задати</Button>
        </div>
      </form>
    </Modal>
  );
}
