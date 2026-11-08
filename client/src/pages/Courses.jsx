import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useData } from '../api.js';
import { useAuth } from '../session.jsx';
import { Button, Empty, ErrorNote, Input, Loader, Modal, PageTools, Textarea, useAction } from '../ui.jsx';
import { IconPlus, IconRoadmap } from '../icons.jsx';
import { plural, studentsWord } from '../fmt.js';
import { CourseIcon, CourseLookPicker, themeClass } from '../courseLook.jsx';

export default function Courses() {
  const { user } = useAuth();
  const isManager = user.role === 'manager';
  const isStudent = user.role === 'student';
  const { data, loading, error, reload } = useData('/courses');
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageTools title="Курси">
        {isManager && <Button icon={<IconPlus size={18} />} onClick={() => setAdding(true)}>Новий курс</Button>}
      </PageTools>
      {error && <ErrorNote text={error} onRetry={reload} />}
      {!data && loading && <Loader />}
      {data && !data.length && <Empty icon={<IconRoadmap size={36} />} title={isManager ? 'Створіть перший курс' : 'Курсів поки немає'} />}
      {data?.length > 0 && (
        <ul className="course-list">
          {data.map((c) => {
            const pct = c.steps_count ? Math.round((c.my_done / c.steps_count) * 100) : 0;
            return (
              <li key={c.id}>
                <Link to={`/courses/${c.id}`} className={`course ${themeClass(c.theme)}`}>
                  <CourseIcon course={c} size={24} />
                  <div className="course-text">
                    <h3>{c.title}</h3>
                    {c.summary && <p className="muted small">{c.summary}</p>}
                  </div>
                  <div className="course-meta">
                    {isStudent
                      ? <span className="progress" role="img" aria-label={`Пройдено ${pct}%`}><i style={{ width: `${pct}%` }} /></span>
                      : <span className="small muted">{studentsWord(c.students_count)}</span>}
                    <span className="small muted">
                      {isStudent ? `${c.my_done} з ${c.steps_count}` : `${c.steps_count} ${plural(c.steps_count, 'етап', 'етапи', 'етапів')}`}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {adding && <CourseForm onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}
    </>
  );
}

export function CourseForm({ course, onClose, onDone }) {
  const [title, setTitle] = useState(course?.title ?? '');
  const [summary, setSummary] = useState(course?.summary ?? '');
  const [icon, setIcon] = useState(course?.icon ?? 'roadmap');
  const [theme, setTheme] = useState(course?.theme ?? 'school');
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(
      () => api(course ? `/courses/${course.id}` : '/courses', { method: course ? 'PATCH' : 'POST', body: { title, summary, icon, theme } }),
      course ? 'Зміни збережено' : 'Курс створено'
    );
    if (ok) onDone();
  };
  return (
    <Modal title={course ? 'Редагувати курс' : 'Новий курс'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Input label="Назва" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Опис" rows={2} maxLength={300} value={summary} onChange={(e) => setSummary(e.target.value)} />
        <CourseLookPicker title={title} icon={icon} theme={theme} onIcon={setIcon} onTheme={setTheme} />
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy}>{course ? 'Зберегти' : 'Створити'}</Button>
        </div>
      </form>
    </Modal>
  );
}
