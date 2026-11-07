import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useData } from '../api.js';
import { useAuth } from '../session.jsx';
import { Button, DatePicker, ErrorNote, IconButton, Input, Linkify, Loader, Modal, PageHead, Status, Textarea, TimePicker, useAction, useUI } from '../ui.jsx';
import { IconDownload, IconEdit, IconFile, IconFolderZip, IconLeft, IconTick, IconTrash } from '../icons.jsx';
import { dateTimeShort, fileSize, nowLocal, time } from '../fmt.js';
import { HW_STATUS } from './Homework.jsx';
import Uploader from '../Uploader.jsx';
import { TopicChips, TopicPicker } from './HomeworkTopics.jsx';

export default function HomeworkDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: hw, loading, error, reload } = useData(`/homework/${id}`);
  const [editing, setEditing] = useState(false);
  const [run] = useAction();
  const { confirm } = useUI();
  const isStudent = user.role === 'student';

  if (error) return <><BackLink /><ErrorNote text={error} onRetry={reload} /></>;
  if (!hw) return loading ? <Loader /> : null;

  const remove = async () => {
    const yes = await confirm({ title: `Видалити «${hw.title}»?`, text: 'Здані роботи та їхні файли теж зникнуть.', action: 'Видалити', danger: true });
    if (yes && (await run(() => api(`/homework/${id}`, { method: 'DELETE' }), 'Домашнє видалено'))) navigate('/homework');
  };

  const late = hw.due_at < nowLocal();
  return (
    <>
      <BackLink />
      <PageHead title={hw.title}>
        {!isStudent && <IconButton label="Редагувати" onClick={() => setEditing(true)}><IconEdit size={20} /></IconButton>}
        {!isStudent && <IconButton label="Видалити" onClick={remove}><IconTrash size={20} /></IconButton>}
      </PageHead>
      <p className={`small ${late ? 'text-red' : 'muted'}`}>Здати до {dateTimeShort(hw.due_at)}</p>
      <p className="muted small">{[hw.lesson_title, hw.teacher_name].filter(Boolean).join(', ')}</p>
      {hw.topics?.length > 0 && (
        <div className="hw-topics">
          <TopicChips topics={hw.topics} />
          {hw.course_id && <Link className="small" to={`/courses/${hw.course_id}`}>На роадмапі курсу</Link>}
        </div>
      )}
      {hw.description && <p className="task"><Linkify text={hw.description} /></p>}

      {isStudent ? <StudentWork hw={hw} onChange={reload} /> : <Submissions hw={hw} onChange={reload} />}
      {editing && <EditHomework hw={hw} onClose={() => setEditing(false)} onDone={() => { setEditing(false); reload(); }} />}
    </>
  );
}
const BackLink = () => <Link to="/homework" className="back"><IconLeft size={18} /> Домашні</Link>;

export function FileList({ files, onRemove }) {
  const shots = files.filter((f) => f.kind === 'screenshot');
  const rest = files.filter((f) => f.kind !== 'screenshot');
  return (
    <>
      {shots.length > 0 && (
        <div className="shots">
          {shots.map((f) => (
            <div key={f.id} className="shot">
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" aria-label={`Відкрити ${f.original_name}`}>
                <img src={`/api/files/${f.id}`} alt={f.original_name} loading="lazy" />
              </a>
              {onRemove && <button type="button" className="shot-x" aria-label={`Прибрати ${f.original_name}`} onClick={() => onRemove(f)}><IconTrash size={15} /></button>}
            </div>
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <ul className="files">
          {rest.map((f) => (
            <li key={f.id}>
              {f.kind === 'archive' ? <IconFolderZip /> : <IconFile />}
              <span className="file-name">{f.original_name}</span>
              <small>{fileSize(f.size)}</small>
              <a className="icon-btn" href={`/api/files/${f.id}?download=1`} aria-label={`Завантажити ${f.original_name}`} title="Завантажити"><IconDownload size={20} /></a>
              {onRemove && <IconButton label={`Прибрати ${f.original_name}`} onClick={() => onRemove(f)}><IconTrash size={20} /></IconButton>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function StudentWork({ hw, onChange }) {
  const sub = hw.submission;
  const status = sub?.status ?? 'todo';
  const [run] = useAction();
  const { confirm } = useUI();
  const canEdit = status !== 'accepted';

  const removeFile = async (f) => {
    const yes = await confirm({ title: `Прибрати «${f.original_name}»?`, action: 'Прибрати', danger: true });
    if (yes && (await run(() => api(`/files/${f.id}`, { method: 'DELETE' }), 'Файл прибрано'))) onChange();
  };

  return (
    <section className="work">
      <header className="work-head">
        <h2>Моя робота</h2>
        {sub?.grade != null ? <span className="grade grade-big" title="Оцінка">{sub.grade}</span> : <Status kind={HW_STATUS[status][0]}>{HW_STATUS[status][1]}</Status>}
      </header>
      {sub?.feedback && (
        <blockquote className="feedback"><IconTick size={20} /> <span><Linkify text={sub.feedback} /></span></blockquote>
      )}
      {sub?.files?.length > 0 && <FileList files={sub.files} onRemove={canEdit ? removeFile : null} />}
      {sub?.comment && <p className="muted small">Коментар: <Linkify text={sub.comment} /></p>}
      {canEdit && <Uploader homeworkId={hw.id} resubmit={Boolean(sub)} canSendWithoutNew={status === 'returned' && sub.files.length > 0} onDone={onChange} />}
    </section>
  );
}

function Submissions({ hw, onChange }) {
  const [reviewing, setReviewing] = useState(null);
  const submitted = hw.students.filter((s) => s.submission).length;
  return (
    <section className="work">
      <header className="work-head">
        <h2>Роботи</h2>
        <span className="small muted">Здали {submitted} із {hw.students.length}</span>
      </header>
      <ul className="rows">
        {hw.students.map((row) => {
          const s = row.submission;
          const st = s?.status ?? 'todo';
          return (
            <li key={row.student_id} className="row">
              <div className="row-main">
                <h3>{row.student_name}</h3>
                <p className="muted small">
                  {s ? `Здано ${dateTimeShort(s.submitted_at)}, файлів: ${s.files.length}` : 'Ще не здано'}
                  {s && s.submitted_at > hw.due_at && <span className="text-red">, із запізненням</span>}
                </p>
              </div>
              {s?.grade != null ? <span className="grade">{s.grade}</span> : <Status kind={HW_STATUS[st][0]}>{st === 'todo' ? 'Не здано' : HW_STATUS[st][1]}</Status>}
              {s && <Button variant={st === 'submitted' ? 'primary' : 'ghost'} small onClick={() => setReviewing(row)}>{st === 'submitted' ? 'Перевірити' : 'Відкрити'}</Button>}
            </li>
          );
        })}
      </ul>
      {reviewing && <ReviewSheet row={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); onChange(); }} />}
    </section>
  );
}

function ReviewSheet({ row, onClose, onDone }) {
  const s = row.submission;
  const [grade, setGrade] = useState(s.grade);
  const [feedback, setFeedback] = useState(s.feedback ?? '');
  const [run, busy] = useAction();
  const send = async (status) => {
    const ok = await run(
      () => api(`/homework/submissions/${s.id}/review`, { method: 'POST', body: { status, grade, feedback } }),
      status === 'accepted' ? 'Роботу прийнято' : 'Роботу повернуто'
    );
    if (ok) onDone();
  };
  return (
    <Modal side title={row.student_name} onClose={onClose}>
      <div className="sheet">
        <p className="muted small">Здано {dateTimeShort(s.submitted_at)}</p>
        {s.comment && <p className="note"><Linkify text={s.comment} /></p>}
        <FileList files={s.files} />
        <div className="field">
          <div className="field-label">Оцінка</div>
          <div className="grades" role="radiogroup" aria-label="Оцінка">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={grade === n} className={grade === n ? 'is-on' : ''} onClick={() => setGrade(grade === n ? null : n)}>{n}</button>
            ))}
          </div>
        </div>
        <Textarea label="Коментар учню" value={feedback} maxLength={3000} onChange={(e) => setFeedback(e.target.value)} />
        <div className="form-actions">
          <Button variant="ghost" busy={busy} onClick={() => send('returned')}>Повернути</Button>
          <Button busy={busy} icon={<IconTick size={18} />} onClick={() => send('accepted')}>Прийняти</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditHomework({ hw, onClose, onDone }) {
  const [title, setTitle] = useState(hw.title);
  const [description, setDescription] = useState(hw.description ?? '');
  const [date, setDate] = useState(hw.due_at.slice(0, 10));
  const [t, setT] = useState(time(hw.due_at));
  const [topics, setTopics] = useState(() => (hw.topics ?? []).map(({ step_id, substep_id }) => ({ step_id, substep_id })));
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(() => api(`/homework/${hw.id}`, { method: 'PATCH', body: { title, description, due_at: `${date} ${t}:00`, ...(hw.schedule_id ? { topics } : {}) } }), 'Зміни збережено');
    if (ok) onDone();
  };
  return (
    <Modal title="Редагувати домашнє" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Input label="Назва" required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Завдання" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="form-row">
          <DatePicker label="Здати до" value={date} onChange={setDate} />
          <TimePicker label="Час" value={t} onChange={setT} />
        </div>
        <TopicPicker query={hw.schedule_id ? `schedule_id=${hw.schedule_id}` : null} value={topics} onChange={setTopics} />
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy}>Зберегти</Button>
        </div>
      </form>
    </Modal>
  );
}
