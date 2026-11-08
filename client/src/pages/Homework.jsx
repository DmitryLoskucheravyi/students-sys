import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, useData } from '../api.js';
import { useAuth } from '../session.jsx';
import { Button, DatePicker, Empty, ErrorNote, Input, LateTag, Loader, Modal, PageHead, Segmented, Select, Status, Textarea, TimePicker, useAction } from '../ui.jsx';
import { IconHomework, IconLesson, IconPlus, IconRoadmap, IconSpark } from '../icons.jsx';
import { WEEKDAYS, addDays, dateTimeShort, nowLocal, shortDate, todayISO } from '../fmt.js';
import { TopicPicker } from './HomeworkTopics.jsx';
import { MyQuizzes, QuizList } from './Quizzes.jsx';

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
  const isManager = user.role === 'manager';
  const [params, setParams] = useSearchParams();
  const tab = !isStudent && params.get('tab') === 'quizzes' ? 'quizzes' : 'homework';
  const navigate = useNavigate();

  return (
    <>
      <PageHead title="Завдання">
        {!isStudent && tab === 'homework' && <HomeworkAdd />}
        {tab === 'quizzes' && (
          <>
            <Button variant="ghost" icon={<IconSpark size={18} />} onClick={() => navigate('/quizzes/new?import=1')}>Тест із ШІ</Button>
            <Button icon={<IconPlus size={18} />} onClick={() => navigate('/quizzes/new')}>Новий тест</Button>
          </>
        )}
      </PageHead>
      {!isStudent && (
        <div className="tabs-row">
          <Segmented value={tab} onChange={(v) => setParams(v === 'quizzes' ? { tab: 'quizzes' } : {}, { replace: true })}
            options={[{ value: 'homework', label: 'Домашні' }, { value: 'quizzes', label: 'Тести' }]} />
        </div>
      )}
      {isStudent && <MyQuizzes />}
      {tab === 'quizzes' ? <QuizList isManager={isManager} /> : <HomeworkList isStudent={isStudent} />}
    </>
  );
}

function HomeworkAdd() {
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  return (
    <>
      <Button icon={<IconPlus size={18} />} onClick={() => setAdding(true)}>Задати домашнє</Button>
      {adding && <NewHomework onClose={() => setAdding(false)} onDone={(id) => navigate(`/homework/${id}`)} />}
    </>
  );
}

function HomeworkList({ isStudent }) {
  const { data, loading, error, reload } = useData('/homework');
  const now = nowLocal();

  return (
    <>
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
                        <h3>{h.my_new && <span className="new-dot" title="Нова оцінка чи відгук"><span className="sr">Нове: </span></span>}{h.title}</h3>
                        <p className="muted small">{h.course_title ?? h.lesson_title}</p>
                      </div>
                      <span className={`small ${late ? 'text-red' : 'muted'}`}>до {dateTimeShort(h.due_at)}</span>
                      {h.my_late && <LateTag />}
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
                  <p className="muted small">{hwWhere(h)}</p>
                </div>
                <span className="small muted">до {dateTimeShort(h.due_at)}</span>
                <span className="small">Здали {h.submitted_count} із {h.students_count}{h.late_count > 0 && <span className="text-red">, із запізненням: {h.late_count}</span>}</span>
                {h.to_review > 0 && <Status kind="scheduled">Перевірити: {h.to_review}</Status>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** «Пн, Чт 17:00» або «12.11 10:00»: як впізнати постановку у списку. */
const placementWhen = (p) => (p.kind === 'weekly'
  ? `${p.weekdays.map((d) => WEEKDAYS[d - 1]).join(', ')} ${p.time}`
  : `${shortDate(p.start_date).slice(0, 5)} ${p.time}`);

/** «Урок, вчитель» або «Курс · роадмап, вчитель»: звідки це домашнє. */
export const hwWhere = (h) => [h.on_roadmap ? `${h.course_title} · роадмап` : h.lesson_title, h.teacher_name].filter(Boolean).join(', ');

function NewHomework({ onClose, onDone }) {
  const { user } = useAuth();
  const placements = useData('/schedules');
  const courses = useData('/courses');
  // До уроку: отримують учні постановки. До теми роадмапу: учні курсу, навіть без розкладу.
  const [target, setTarget] = useState('lesson');
  const [scheduleId, setScheduleId] = useState(null);
  const [courseId, setCourseId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(addDays(todayISO(), 7));
  const [time, setTime] = useState('23:55');
  const [topics, setTopics] = useState([]);
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const where = target === 'course' ? { course_id: courseId } : { schedule_id: scheduleId };
    const r = await run(() => api('/homework', { method: 'POST', body: { ...where, title, description, due_at: `${date} ${time}:00`, topics } }), 'Домашнє задано');
    if (r) onDone(r.id);
  };
  const pick = (v) => { setScheduleId(v); setTopics([]); };
  const pickCourse = (v) => { setCourseId(v); setTopics([]); };
  const switchTarget = (v) => { setTarget(v); setTopics([]); };
  const ready = target === 'course' ? courseId && topics.length > 0 : scheduleId;
  return (
    <Modal title="Задати домашнє" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Segmented label="Куди" value={target} onChange={switchTarget} options={[
          { value: 'lesson', label: 'До уроку', icon: <IconLesson size={16} /> },
          { value: 'course', label: 'До теми роадмапу', icon: <IconRoadmap size={16} /> },
        ]} />
        {target === 'lesson' ? (
          <Select label="Урок" value={scheduleId} onChange={pick} placeholder="Оберіть урок у розкладі"
            options={(placements.data ?? []).map((p) => ({
              value: p.id,
              label: `${p.title} · ${placementWhen(p)}`,
              hint: [p.teacher_name, p.students.map((s) => s.name).join(', ') || 'без учнів'].filter(Boolean).join(' · '),
            }))} />
        ) : (
          <Select label="Курс" value={courseId} onChange={pickCourse} placeholder="Оберіть курс"
            hint={user.role === 'teacher' ? 'Отримають ваші учні цього курсу.' : 'Отримають усі учні курсу: з розкладу й додані напряму.'}
            options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))} />
        )}
        <Input label="Назва" required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Завдання" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="form-row">
          <DatePicker label="Здати до" value={date} onChange={setDate} />
          <TimePicker label="Час" value={time} onChange={setTime} />
        </div>
        {target === 'lesson'
          ? <TopicPicker query={scheduleId ? `schedule_id=${scheduleId}` : null} value={topics} onChange={setTopics} />
          : courseId && <TopicPicker source={`/courses/${courseId}`} value={topics} onChange={setTopics} hint="Оберіть хоча б одну тему: домашнє з’явиться на роадмапі в ній." />}
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy} disabled={!ready}>Задати</Button>
        </div>
      </form>
    </Modal>
  );
}
