/* Учні курсу: додані напряму й з розкладу, закріплений вчитель. */
import { useState } from 'react';
import { api, useData } from '../../api.js';
import { Button, IconButton, Modal, Select, useAction, useUI } from '../../ui.jsx';
import { IconPlus, IconTrash } from '../../icons.jsx';
import { Who } from '../../avatars.jsx';

/**
 * Учні курсу. Напряму доданих менеджер прибирає тут; учні з розкладу лишаються, доки стоять у розкладі.
 * Закріплений вчитель бачить курс і веде прогрес учня.
 */
export function CourseStudents({ course, onClose, onChange }) {
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
