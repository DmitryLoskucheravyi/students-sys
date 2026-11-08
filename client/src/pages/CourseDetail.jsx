import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useData } from '../api.js';
import { useAuth } from '../session.jsx';
import { Button, Empty, ErrorNote, IconButton, Linkify, Loader, PageHead, Select, useAction, useUI } from '../ui.jsx';
import { IconEdit, IconLeft, IconPeople, IconPlus, IconRoadmap, IconSpark, IconTrash } from '../icons.jsx';
import { CourseForm } from './Courses.jsx';
import RoadmapAi from './RoadmapAi.jsx';
import { CourseIcon, themeClass } from '../courseLook.jsx';
import { Avatar } from '../avatars.jsx';
import { ProgressCard } from './course/ProgressCard.jsx';
import { RoadmapPath } from './course/Roadmap.jsx';
import { CourseStudents } from './course/CourseStudents.jsx';
import { RoadmapEditor } from './course/RoadmapEditor.jsx';

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
              homework={viewerId ? course.homework.filter((h) => h.student_ids.includes(viewerId)) : course.homework} />
          )}
        </>
      )}
      {editCourse && <CourseForm course={course} onClose={() => setEditCourse(false)} onDone={() => { setEditCourse(false); reload(); }} />}
      {aiOpen && <RoadmapAi course={course} onClose={() => setAiOpen(false)} onDone={() => { setAiOpen(false); setMode('view'); reload(); }} />}
      {peopleOpen && <CourseStudents course={course} onClose={() => setPeopleOpen(false)} onChange={reload} />}
    </div>
  );
}
