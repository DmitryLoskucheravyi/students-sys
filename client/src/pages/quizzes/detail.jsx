/* Сторінка тесту для менеджера чи автора: питання, учні, модерація, посилання. */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useData } from '../../api.js';
import { useAuth } from '../../session.jsx';
import { Button, DatePicker, ErrorNote, IconButton, Linkify, Loader, Modal, PageHead, Select, Status, Textarea, TimePicker, useAction, useUI } from '../../ui.jsx';
import { Who } from '../../avatars.jsx';
import { CodeText } from '../../codeText.jsx';
import { IconCopy, IconEdit, IconExternal, IconLeft, IconRestore, IconTick, IconTrash, IconUser } from '../../icons.jsx';
import { dateTimeShort, time } from '../../fmt.js';
import { notify, questionsWord, imageUrl } from './common.js';
import { QuizState, QUIZ_STATUS } from './list.jsx';

/* Менеджер: тест, його питання та учні */
export function QuizDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = user.role === 'manager';
  const { data: quiz, loading, error, reload } = useData(`/quizzes/${id}`);
  const [assigning, setAssigning] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [run] = useAction();
  const { confirm } = useUI();
  if (error) return <ErrorNote text={error} onRetry={reload} />;
  if (!quiz) return loading ? <Loader /> : null;

  const removeQuiz = async () => {
    const yes = await confirm({ title: `Видалити тест «${quiz.title}»?`, text: 'Результати учнів теж зникнуть.', action: 'Видалити', danger: true });
    if (yes && (await run(() => api(`/quizzes/${quiz.id}`, { method: 'DELETE' }), 'Тест видалено'))) navigate('/homework?tab=quizzes');
  };
  const reset = async (a) => {
    const yes = await confirm({ title: `Дати ${a.student_name} ще одну спробу?`, text: `Поточний результат ${a.score} з ${a.max_score} буде стерто.`, action: 'Дати спробу' });
    if (yes && (await run(() => api(`/quizzes/assignments/${a.id}/reset`, { method: 'POST' }), 'Тест знову відкрито'))) reload();
  };
  const unassign = async (a) => {
    const yes = await confirm({ title: `Закрити тест для ${a.student_name}?`, text: a.submitted_at ? 'Результат учня зникне.' : 'Учень більше не бачитиме цей тест.', action: 'Закрити', danger: true });
    if (yes && (await run(() => api(`/quizzes/assignments/${a.id}`, { method: 'DELETE' }), 'Тест закрито для учня'))) reload();
  };

  return (
    <>
      <Link to="/homework?tab=quizzes" className="back"><IconLeft size={18} /> Тести</Link>
      <PageHead title={quiz.title}>
        {quiz.status === 'approved' && <Button variant="ghost" icon={<IconExternal size={18} />} onClick={() => setSharing(true)}>{quiz.share_token ? 'Посилання' : 'Поділитися посиланням'}</Button>}
        {isManager && quiz.status === 'approved' && <Button icon={<IconUser size={18} />} onClick={() => setAssigning({})}>Відкрити учневі</Button>}
        {isManager && quiz.status === 'pending' && (
          <>
            <Button icon={<IconTick size={18} />} onClick={async () => { if (await run(() => api(`/quizzes/${quiz.id}/approve`, { method: 'POST' }), 'Тест схвалено')) { notify(); reload(); } }}>Схвалити</Button>
            <Button variant="ghost" onClick={() => setRejecting(true)}>Відхилити</Button>
          </>
        )}
        {(isManager || quiz.status !== 'approved') && <IconButton label="Редагувати тест" onClick={() => navigate(`/quizzes/${quiz.id}/edit`)}><IconEdit size={20} /></IconButton>}
        {(isManager || quiz.status !== 'approved') && <IconButton label="Видалити тест" onClick={removeQuiz}><IconTrash size={20} /></IconButton>}
      </PageHead>
      {quiz.status !== 'approved' && (
        <p className={`note small quiz-moder is-${quiz.status}`}>
          <Status kind={QUIZ_STATUS[quiz.status][0]}>{QUIZ_STATUS[quiz.status][1]}</Status>{' '}
          {quiz.status === 'pending'
            ? (isManager ? `Тест створив вчитель ${quiz.author_name ?? ''}. Перевірте питання й схваліть, щоб учні його побачили.` : 'Менеджер ще не перевірив тест.')
            : <>Тест відхилено{quiz.review_note ? `: ${quiz.review_note}` : ''}. {isManager ? '' : 'Виправте його, і він знову піде на модерацію.'}</>}
        </p>
      )}
      {quiz.description && <p className="muted lead"><Linkify text={quiz.description} /></p>}

      {isManager && <section className="work">
        <header className="work-head">
          <h2>Учні</h2>
          <span className="small muted">Пройшли {quiz.assignments.filter((a) => a.submitted_at).length} з {quiz.assignments.length}</span>
        </header>
        {quiz.assignments.length ? (
          <ul className="rows">
            {quiz.assignments.map((a) => (
              <li key={a.id} className="row quiz-assign">
                <div className="row-main">
                  <h3><Link to={`/tests/${a.id}`}><Who name={a.student_name} avatar={a.student_avatar} size={30} /></Link></h3>
                  <p className="muted small">
                    {[a.course_title, a.due_at && `до ${dateTimeShort(a.due_at)}`, a.submitted_at && `пройдено ${dateTimeShort(a.submitted_at)}`].filter(Boolean).join(' · ') || 'Без курсу'}
                  </p>
                </div>
                <QuizState a={a} />
                <div className="row-actions">
                  <IconButton label={`Курс і теми для ${a.student_name}`} onClick={() => setAssigning(a)}><IconEdit size={18} /></IconButton>
                  {a.submitted_at && <IconButton label={`Ще спроба для ${a.student_name}`} onClick={() => reset(a)}><IconRestore size={18} /></IconButton>}
                  <IconButton label={`Закрити тест для ${a.student_name}`} onClick={() => unassign(a)}><IconTrash size={18} /></IconButton>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">Тест ще нікому не відкрито.</p>}
      </section>}

      <section className="work">
        <header className="work-head"><h2>Питання</h2><span className="small muted">{questionsWord(quiz.questions.length)}</span></header>
        <ol className="q-preview">
          {quiz.questions.map((x) => (
            <li key={x.id}>
              <div className="q-text"><CodeText text={x.text} kind="question" /></div>
              {x.image && <img className="q-img" src={imageUrl(x.image)} alt="" loading="lazy" />}
              <ul className="q-answers">
                {x.options.map((o) => <li key={o.id} className={o.correct ? 'is-correct' : ''}>{o.correct ? <IconTick size={16} /> : <i />}<span><CodeText text={o.text} /></span></li>)}
              </ul>
            </li>
          ))}
        </ol>
      </section>
      {sharing && <ShareForm quiz={quiz} onClose={() => setSharing(false)} onChange={reload} />}
      {rejecting && <RejectForm quiz={quiz} onClose={() => setRejecting(false)} onDone={() => { setRejecting(false); notify(); reload(); }} />}
      {assigning && <AssignForm quiz={quiz} assignment={assigning.id ? assigning : null}
        onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); reload(); }} />}
    </>
  );
}

function RejectForm({ quiz, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    if (await run(() => api(`/quizzes/${quiz.id}/reject`, { method: 'POST', body: { note } }), 'Тест відхилено')) onDone();
  };
  return (
    <Modal narrow title="Відхилити тест" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Textarea label="Що виправити" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" variant="danger" busy={busy}>Відхилити</Button>
        </div>
      </form>
    </Modal>
  );
}

function AssignForm({ quiz, assignment, onClose, onDone }) {
  const people = useData('/users');
  const courses = useData('/courses');
  const [studentId, setStudentId] = useState(assignment?.student_id ?? null);
  const [courseId, setCourseId] = useState(assignment?.course_id ?? null);
  const [date, setDate] = useState(assignment?.due_at?.slice(0, 10) ?? null);
  const [t, setT] = useState(assignment?.due_at ? time(assignment.due_at) : '23:55');
  const [run, busy] = useAction();
  const taken = new Set(quiz.assignments.map((a) => a.student_id));
  const pupils = (people.data ?? []).filter((u) => u.role === 'student' && u.is_active && (!taken.has(u.id) || u.id === assignment?.student_id))
    .map((u) => ({ value: u.id, label: u.name }));

  const submit = async (e) => {
    e.preventDefault();
    const body = { student_id: studentId, course_id: courseId, due_at: date ? `${date} ${t}:00` : null };
    const ok = await run(
      () => (assignment ? api(`/quizzes/assignments/${assignment.id}`, { method: 'PATCH', body }) : api(`/quizzes/${quiz.id}/assignments`, { method: 'POST', body })),
      assignment ? 'Зміни збережено' : 'Тест відкрито учневі'
    );
    if (ok) onDone();
  };
  return (
    <Modal side title={assignment ? assignment.student_name : 'Відкрити тест учневі'} onClose={onClose}>
      <form className="form sheet" onSubmit={submit}>
        {!assignment && <Select label="Учень" value={studentId} onChange={setStudentId} placeholder="Оберіть учня" options={pupils} />}
        <Select label="Курс" value={courseId} clearable placeholder="Без курсу"
          onChange={setCourseId} options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))} />
        <div className="form-row">
          <DatePicker label="Пройти до" value={date} onChange={setDate} clearable placeholder="Без терміну" />
          {date && <TimePicker label="Час" value={t} onChange={setT} />}
        </div>
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy} disabled={!studentId}>{assignment ? 'Зберегти' : 'Відкрити тест'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Посилання на тест: вмикається тут, скопіювати й надіслати будь-кому. */
export function ShareForm({ quiz, onClose, onChange }) {
  const [token, setToken] = useState(quiz.share_token);
  const [run, busy] = useAction();
  const { toast } = useUI();
  const url = token ? `${window.location.origin}/q/${token}` : '';
  const enable = async () => { const r = await run(() => api(`/quizzes/${quiz.id}/share`, { method: 'POST' })); if (r) { setToken(r.share_token); onChange(); } };
  const disable = async () => { if (await run(() => api(`/quizzes/${quiz.id}/share`, { method: 'DELETE' }), 'Посилання вимкнено')) { setToken(null); onChange(); } };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast('Посилання скопійовано'); } catch { toast('Не вдалося скопіювати. Виділіть посилання вручну', 'error'); }
  };
  return (
    <Modal narrow title="Посилання на тест" onClose={onClose}>
      <div className="form share-form">
        {token ? (
          <>
            <div className="share-url">
              <input className="input" readOnly value={url} aria-label="Посилання на тест" onFocus={(e) => e.target.select()} />
              <Button icon={<IconCopy size={18} />} onClick={copy}>Скопіювати</Button>
            </div>
            <div className="form-actions">
              <Button variant="ghost" busy={busy} onClick={disable}>Вимкнути посилання</Button>
              <Button variant="ghost" onClick={onClose}>Готово</Button>
            </div>
          </>
        ) : (
          <div className="form-actions">
            <Button variant="ghost" onClick={onClose}>Назад</Button>
            <Button busy={busy} icon={<IconExternal size={18} />} onClick={enable}>Створити посилання</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
