import { useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, uploadForm, useData } from '../api.js';
import { useAuth } from '../session.jsx';
import { Button, Checkbox, DatePicker, Empty, ErrorNote, IconButton, Input, LateTag, Linkify, Loader, Modal, PageHead, Select, Status, Textarea, TimePicker, useAction, useUI } from '../ui.jsx';
import { IconClose, IconCopy, IconDown, IconEdit, IconImage, IconLeft, IconPlus, IconQuiz, IconRestore, IconRight, IconSpark, IconTick, IconTrash, IconUp, IconUser } from '../icons.jsx';
import { dateTimeShort, isLate, nowLocal, plural, time } from '../fmt.js';
import { TopicChips, TopicPicker } from './HomeworkTopics.jsx';
import { MAX_OPTIONS, MAX_QUESTIONS, MIN_OPTIONS, QUIZ_PROMPT, parseQuizAnswer } from '../quizImport.js';

/** Перерахувати лічильник сповіщень у навігації. */
export const notify = () => window.dispatchEvent(new Event('bs:notify'));
const questionsWord = (n) => `${n} ${plural(n, 'питання', 'питання', 'питань')}`;
const imageUrl = (name) => `/api/quizzes/images/${name}`;

let seq = 0;
const key = () => `k${++seq}`;
const blankOption = () => ({ key: key(), text: '', correct: false });
const blankQuestion = () => ({ key: key(), text: '', image: null, options: Array.from({ length: 4 }, blankOption) });
const fromServer = (questions) => questions.map((x) => ({
  key: key(), id: x.id, text: x.text, image: x.image,
  options: x.options.map((o) => ({ key: key(), id: o.id, text: o.text, correct: Boolean(o.correct) })),
}));

/** Стан проходження: «Треба пройти» або бал. */
export function QuizState({ a }) {
  if (!a.submitted_at) return <Status kind="warn">Треба пройти</Status>;
  return (
    <>
      {isLate(a.submitted_at, a.due_at) && <LateTag />}
      <Status kind={a.score / a.max_score >= 0.5 ? 'completed' : 'cancelled'}>{a.score} з {a.max_score}</Status>
    </>
  );
}

/* Менеджер: список тестів (вкладка на сторінці завдань) */
export function QuizList() {
  const { data, loading, error, reload } = useData('/quizzes');
  const navigate = useNavigate();
  if (error) return <ErrorNote text={error} onRetry={reload} />;
  if (!data) return loading ? <Loader /> : null;
  if (!data.length) {
    return <Empty icon={<IconQuiz size={36} />} title="Тестів ще немає"
      action={<Button icon={<IconPlus size={18} />} onClick={() => navigate('/quizzes/new')}>Створити тест</Button>} />;
  }
  return (
    <ul className="rows">
      {data.map((z) => (
        <li key={z.id}>
          <Link className="row row-link quiz-row" to={`/quizzes/${z.id}`}>
            <span className="quiz-ico"><IconQuiz size={20} /></span>
            <div className="row-main">
              <h3>{z.title}</h3>
              <p className="muted small">{questionsWord(z.questions_count)}</p>
            </div>
            <span className="small muted">{z.assigned_count ? `Пройшли ${z.done_count} з ${z.assigned_count}` : 'Ще нікому не відкрито'}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* Учень: тести на сторінці завдань */
export function MyQuizzes() {
  const { data } = useData('/quizzes/my');
  if (!data?.length) return null;
  const open = data.filter((a) => !a.submitted_at).length;
  const now = nowLocal();
  return (
    <section className="hw-group">
      <h2>Тести {open > 0 && <span className="count">{open}</span>}</h2>
      <ul className="rows">
        {data.map((a) => (
          <li key={a.id}>
            <Link className={`row row-link quiz-row ${a.submitted_at ? '' : 'is-open'}`} to={`/tests/${a.id}`}>
              <span className="quiz-ico"><IconQuiz size={20} /></span>
              <div className="row-main">
                <h3>{a.quiz_title}</h3>
                <p className="muted small">{[a.course_title, questionsWord(a.questions_count)].filter(Boolean).join(' · ')}</p>
              </div>
              {a.due_at && !a.submitted_at && <span className={`small ${a.due_at < now ? 'text-red' : 'muted'}`}>до {dateTimeShort(a.due_at)}</span>}
              <QuizState a={a} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Редактор тесту: вручну або з відповіді зовнішнього ШІ */
export function QuizEditor() {
  const { id } = useParams();
  const isNew = !id;
  const existing = useData(isNew ? null : `/quizzes/${id}`);
  if (!isNew && existing.error) return <ErrorNote text={existing.error} onRetry={existing.reload} />;
  if (!isNew && !existing.data) return <Loader />;
  return <QuizForm key={id ?? 'new'} quiz={isNew ? null : existing.data} />;
}

function QuizForm({ quiz }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(quiz?.title ?? '');
  const [description, setDescription] = useState(quiz?.description ?? '');
  const [questions, setQuestions] = useState(() => (quiz ? fromServer(quiz.questions) : [blankQuestion()]));
  const [params] = useSearchParams();
  const [aiOpen, setAiOpen] = useState(!quiz && params.get('import') === '1');
  const [run, busy] = useAction();
  const done = quiz?.assignments?.filter((a) => a.submitted_at).length ?? 0;

  const setQ = (k, patch) => setQuestions((list) => list.map((x) => (x.key === k ? { ...x, ...patch } : x)));
  const move = (i, d) => setQuestions((list) => { const next = [...list]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x); return next; });
  const remove = (k) => setQuestions((list) => list.filter((x) => x.key !== k));
  const addDraft = (draft, draftTitle) => {
    if (draftTitle && !title.trim()) setTitle(draftTitle);
    const pristine = (x) => !x.text.trim() && !x.image && x.options.every((o) => !o.text.trim());
    setQuestions((list) => [...list.filter((x) => !pristine(x)), ...draft.map((x) => ({
      key: key(), text: x.text, image: null, options: x.options.map((o) => ({ key: key(), text: o.text, correct: o.correct })),
    }))].slice(0, MAX_QUESTIONS));
  };

  const save = async (e) => {
    e.preventDefault();
    const body = {
      title, description,
      questions: questions.map((x) => ({ id: x.id, text: x.text, image: x.image, options: x.options.map((o) => ({ id: o.id, text: o.text, correct: o.correct })) })),
    };
    const r = await run(() => (quiz ? api(`/quizzes/${quiz.id}`, { method: 'PUT', body }) : api('/quizzes', { method: 'POST', body })), quiz ? 'Тест збережено' : 'Тест створено');
    if (r) navigate(`/quizzes/${quiz?.id ?? r.id}`);
  };

  return (
    <>
      <Link to={quiz ? `/quizzes/${quiz.id}` : '/homework?tab=quizzes'} className="back"><IconLeft size={18} /> {quiz ? quiz.title : 'Тести'}</Link>
      <PageHead title={quiz ? 'Редагувати тест' : 'Новий тест'}>
        <Button variant="ghost" icon={<IconSpark size={18} />} onClick={() => setAiOpen(true)}>Вставити з ШІ</Button>
      </PageHead>
      {done > 0 && <p className="note small">Тест уже пройшли: {done}. Їхні бали не зміняться, нові учні проходитимуть оновлений варіант.</p>}
      <form className="quiz-form" onSubmit={save}>
        <div className="form quiz-head">
          <Input label="Назва тесту" required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea label="Опис для учня" hint="Необов’язково" rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <ol className="q-list">
          {questions.map((x, i) => (
            <QuestionEditor key={x.key} q={x} n={i + 1} total={questions.length}
              onChange={(patch) => setQ(x.key, patch)} onMove={(d) => move(i, d)} onRemove={() => remove(x.key)} />
          ))}
        </ol>
        <div className="quiz-actions">
          <Button variant="ghost" icon={<IconPlus size={18} />} disabled={questions.length >= MAX_QUESTIONS}
            onClick={() => setQuestions([...questions, blankQuestion()])}>Додати питання</Button>
          <div className="quiz-save">
            <span className="muted small">{questionsWord(questions.length)}</span>
            <Button type="submit" busy={busy} icon={<IconTick size={18} />}>{quiz ? 'Зберегти тест' : 'Створити тест'}</Button>
          </div>
        </div>
      </form>
      {aiOpen && <QuizImport onClose={() => setAiOpen(false)} onDone={(draft, t) => { addDraft(draft, t); setAiOpen(false); }} />}
    </>
  );
}

function QuestionEditor({ q, n, total, onChange, onMove, onRemove }) {
  const fileRef = useRef(null);
  const [run, uploading] = useAction();
  const setOpt = (k, patch) => onChange({ options: q.options.map((o) => (o.key === k ? { ...o, ...patch } : o)) });
  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    const r = await run(() => uploadForm('/quizzes/images', form));
    if (r) onChange({ image: r.image });
  };
  const noCorrect = q.options.every((o) => !o.correct);
  return (
    <li className="q-card">
      <header className="q-head">
        <h3>Питання {n}</h3>
        <div className="row-actions">
          <IconButton label="Вище" disabled={n === 1} onClick={() => onMove(-1)}><IconUp size={18} /></IconButton>
          <IconButton label="Нижче" disabled={n === total} onClick={() => onMove(1)}><IconDown size={18} /></IconButton>
          <IconButton label={`Видалити питання ${n}`} disabled={total === 1} onClick={onRemove}><IconTrash size={18} /></IconButton>
        </div>
      </header>
      <Textarea label="Питання" required rows={2} maxLength={500} value={q.text} onChange={(e) => onChange({ text: e.target.value })} />
      <div className="q-image">
        {q.image ? (
          <figure>
            <img src={imageUrl(q.image)} alt={`Картинка до питання ${n}`} />
            <IconButton className="q-image-x" label={`Прибрати картинку питання ${n}`} onClick={() => onChange({ image: null })}><IconClose size={18} /></IconButton>
          </figure>
        ) : (
          <Button variant="ghost" small busy={uploading} icon={<IconImage size={16} />} onClick={() => fileRef.current?.click()}>Додати картинку</Button>
        )}
        <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" aria-label={`Картинка до питання ${n}`} onChange={pickImage} />
      </div>
      <fieldset className="q-options">
        <legend>Варіанти <span className="muted small">· позначте одну або кілька правильних</span></legend>
        {q.options.map((o, k) => (
          <div key={o.key} className={`q-option ${o.correct ? 'is-correct' : ''}`}>
            <Checkbox checked={o.correct} onChange={(v) => setOpt(o.key, { correct: v })}><span className="sr">Правильна відповідь {k + 1}</span></Checkbox>
            <input className="input" required maxLength={200} placeholder={`Варіант ${k + 1}`} aria-label={`Питання ${n}, варіант ${k + 1}`}
              value={o.text} onChange={(e) => setOpt(o.key, { text: e.target.value })} />
            <IconButton label={`Прибрати варіант ${k + 1}`} disabled={q.options.length <= MIN_OPTIONS}
              onClick={() => onChange({ options: q.options.filter((x) => x.key !== o.key) })}><IconClose size={16} /></IconButton>
          </div>
        ))}
        <div className="q-options-foot">
          <Button variant="ghost" small icon={<IconPlus size={16} />} disabled={q.options.length >= MAX_OPTIONS}
            onClick={() => onChange({ options: [...q.options, blankOption()] })}>Варіант</Button>
          {noCorrect && <span className="small text-red">Позначте правильну відповідь</span>}
        </div>
      </fieldset>
    </li>
  );
}

/** Промпт для будь-якого ШІ й розбір його відповіді: питання, варіанти й правильні відповіді стають на місця. */
function QuizImport({ onClose, onDone }) {
  const [text, setText] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const { toast } = useUI();
  const promptRef = useRef(null);
  const result = text.trim() ? parseQuizAnswer(text) : null;
  const found = result?.questions.length ?? 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(QUIZ_PROMPT);
    } catch {
      // Без доступу до буфера: показати промпт виділеним, щоб скопіювати вручну.
      setShowPrompt(true);
      requestAnimationFrame(() => { promptRef.current?.focus(); promptRef.current?.select(); });
      toast('Не вдалося скопіювати. Промпт виділено, натисніть Ctrl+C', 'error');
      return;
    }
    toast('Промпт скопійовано');
  };
  const submit = (e) => {
    e.preventDefault();
    if (found) onDone(result.questions, result.title);
  };

  return (
    <Modal title="Тест із ШІ" onClose={onClose}>
      <form className="form quiz-import" onSubmit={submit}>
        <ol className="qi-steps">
          <li>
            <div>
              <strong>Скопіюйте промпт</strong>
              <p className="muted small">У ньому лише формат відповіді. Матеріал уроку додасте в чаті самі.</p>
            </div>
            <div className="qi-copy">
              <Button icon={<IconCopy size={18} />} onClick={copy}>Скопіювати промпт</Button>
              <Button variant="ghost" small aria-expanded={showPrompt} onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? 'Сховати' : 'Показати'}</Button>
            </div>
            {showPrompt && <textarea ref={promptRef} className="input qi-prompt" readOnly rows={10} value={QUIZ_PROMPT} aria-label="Текст промпту" />}
          </li>
          <li>
            <div>
              <strong>Надішліть його в будь-який ШІ</strong>
              <p className="muted small">ChatGPT, Gemini, Claude чи інший. Після промпту вставте конспект або тему уроку.</p>
            </div>
          </li>
          <li>
            <div>
              <strong>Вставте відповідь ШІ сюди</strong>
            </div>
            <Textarea label="Відповідь ШІ" rows={9} maxLength={60000} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={'Назва: …\n\n? Питання\n+ правильний варіант\n- неправильний варіант'} />
          </li>
        </ol>
        {result && (
          <div className={`qi-result ${found ? '' : 'is-empty'}`} role="status">
            <p>
              {found
                ? <><IconTick size={16} /> Знайдено {questionsWord(found)}{result.title && <> · «{result.title}»</>}</>
                : 'Не знайдено жодного питання. Перевірте, що відповідь у форматі з промпту.'}
            </p>
            {result.skipped.length > 0 && (
              <>
                <p className="small">Пропущено {result.skipped.length}:</p>
                <ul className="qi-skipped small">
                  {result.skipped.slice(0, 8).map((s) => (
                    <li key={s.n}><strong>Питання {s.n}</strong>{s.text && <> «{s.text.length > 60 ? `${s.text.slice(0, 60)}…` : s.text}»</>}: {s.reason}</li>
                  ))}
                  {result.skipped.length > 8 && <li>і ще {result.skipped.length - 8}</li>}
                </ul>
              </>
            )}
          </div>
        )}
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" disabled={!found} icon={<IconTick size={18} />}>Розставити питання</Button>
        </div>
      </form>
    </Modal>
  );
}

/* Менеджер: тест, його питання та учні */
export function QuizDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: quiz, loading, error, reload } = useData(`/quizzes/${id}`);
  const [assigning, setAssigning] = useState(null);
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
        <Button icon={<IconUser size={18} />} onClick={() => setAssigning({})}>Відкрити учневі</Button>
        <IconButton label="Редагувати тест" onClick={() => navigate(`/quizzes/${quiz.id}/edit`)}><IconEdit size={20} /></IconButton>
        <IconButton label="Видалити тест" onClick={removeQuiz}><IconTrash size={20} /></IconButton>
      </PageHead>
      {quiz.description && <p className="muted lead"><Linkify text={quiz.description} /></p>}

      <section className="work">
        <header className="work-head">
          <h2>Учні</h2>
          <span className="small muted">Пройшли {quiz.assignments.filter((a) => a.submitted_at).length} з {quiz.assignments.length}</span>
        </header>
        {quiz.assignments.length ? (
          <ul className="rows">
            {quiz.assignments.map((a) => (
              <li key={a.id} className="row quiz-assign">
                <div className="row-main">
                  <h3><Link to={`/tests/${a.id}`}>{a.student_name}</Link></h3>
                  <p className="muted small">
                    {[a.course_title, a.due_at && `до ${dateTimeShort(a.due_at)}`, a.submitted_at && `пройдено ${dateTimeShort(a.submitted_at)}`].filter(Boolean).join(' · ') || 'Без курсу'}
                  </p>
                  <TopicChips topics={a.topics} />
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
      </section>

      <section className="work">
        <header className="work-head"><h2>Питання</h2><span className="small muted">{questionsWord(quiz.questions.length)}</span></header>
        <ol className="q-preview">
          {quiz.questions.map((x) => (
            <li key={x.id}>
              <p className="q-text">{x.text}</p>
              {x.image && <img className="q-img" src={imageUrl(x.image)} alt="" loading="lazy" />}
              <ul className="q-answers">
                {x.options.map((o) => <li key={o.id} className={o.correct ? 'is-correct' : ''}>{o.correct ? <IconTick size={16} /> : <i />}{o.text}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </section>
      {assigning && <AssignForm quiz={quiz} assignment={assigning.id ? assigning : null}
        onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); reload(); }} />}
    </>
  );
}

function AssignForm({ quiz, assignment, onClose, onDone }) {
  const people = useData('/users');
  const courses = useData('/courses');
  const [studentId, setStudentId] = useState(assignment?.student_id ?? null);
  const [courseId, setCourseId] = useState(assignment?.course_id ?? null);
  const [topics, setTopics] = useState(() => (assignment?.topics ?? []).map(({ step_id, substep_id }) => ({ step_id, substep_id })));
  const [date, setDate] = useState(assignment?.due_at?.slice(0, 10) ?? null);
  const [t, setT] = useState(assignment?.due_at ? time(assignment.due_at) : '23:55');
  const [run, busy] = useAction();
  const taken = new Set(quiz.assignments.map((a) => a.student_id));
  const pupils = (people.data ?? []).filter((u) => u.role === 'student' && u.is_active && (!taken.has(u.id) || u.id === assignment?.student_id))
    .map((u) => ({ value: u.id, label: u.name }));

  const submit = async (e) => {
    e.preventDefault();
    const body = { student_id: studentId, course_id: courseId, topics: courseId ? topics : [], due_at: date ? `${date} ${t}:00` : null };
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
        <Select label="Курс" hint="Необов’язково. Потрібен, щоб показати тест на роадмапі" value={courseId} clearable placeholder="Без курсу"
          onChange={(v) => { setCourseId(v); setTopics([]); }} options={(courses.data ?? []).map((c) => ({ value: c.id, label: c.title }))} />
        {courseId && <TopicPicker source={`/courses/${courseId}`} value={topics} onChange={setTopics} hint="У цих темах на роадмапі учня з’явиться «Пройти тест»." />}
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

/* Проходження тесту учнем і перегляд результату */
export function QuizTake() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: a, loading, error, reload } = useData(`/quizzes/assignments/${id}`);
  const [answers, setAnswers] = useState({});
  const [run, busy] = useAction();
  const { confirm } = useUI();
  const isStudent = user.role === 'student';
  const back = isStudent ? '/homework' : a ? `/quizzes/${a.quiz_id}` : '/homework';

  if (error) return <><Link to="/homework" className="back"><IconLeft size={18} /> Завдання</Link><ErrorNote text={error} onRetry={reload} /></>;
  if (!a) return loading ? <Loader /> : null;

  const done = Boolean(a.submitted_at);
  const answered = a.questions.filter((x) => answers[x.id]?.length).length;
  const pick = (x, optionId) => {
    const cur = answers[x.id] ?? [];
    const next = x.multiple ? (cur.includes(optionId) ? cur.filter((v) => v !== optionId) : [...cur, optionId]) : [optionId];
    setAnswers({ ...answers, [x.id]: next });
  };
  const submit = async () => {
    const left = a.questions.length - answered;
    if (left > 0) {
      const yes = await confirm({ title: 'Здати тест?', text: `Без відповіді ${left} ${plural(left, 'питання', 'питання', 'питань')}. Їх буде зараховано як неправильні.`, action: 'Здати' });
      if (!yes) return;
    }
    const r = await run(() => api(`/quizzes/assignments/${a.id}/submit`, { method: 'POST', body: { answers } }), 'Тест здано');
    if (r) { notify(); reload(); window.scrollTo({ top: 0 }); }
  };

  return (
    <>
      <Link to={back} className="back"><IconLeft size={18} /> {isStudent ? 'Завдання' : a.quiz_title}</Link>
      <PageHead title={a.quiz_title} />
      <p className="muted small">
        {[!isStudent && a.student_name, a.course_title, questionsWord(a.questions.length), a.due_at && !done && `пройти до ${dateTimeShort(a.due_at)}`].filter(Boolean).join(' · ')}
      </p>
      {a.description && <p className="task"><Linkify text={a.description} /></p>}
      <TopicChips topics={a.topics} />

      {done && (
        <section className={`quiz-score ${a.score / a.max_score >= 0.5 ? 'is-good' : 'is-low'}`} aria-label="Результат">
          <strong>{a.score}<small> з {a.max_score}</small></strong>
          <div>
            <p>{Math.round((a.score / a.max_score) * 100)}% правильних відповідей</p>
            <p className="muted small">Пройдено {dateTimeShort(a.submitted_at)}{isLate(a.submitted_at, a.due_at) && <> <LateTag /></>}. Нижче видно правильні відповіді.</p>
          </div>
        </section>
      )}
      {!done && !isStudent && <p className="note small">Учень ще не пройшов тест. Правильні відповіді позначено.</p>}

      <ol className="q-take">
        {a.questions.map((x, i) => {
          const chosen = done ? x.chosen : answers[x.id] ?? [];
          return (
            <li key={x.id} className={`q-card ${done ? (x.right ? 'is-right' : 'is-wrong') : ''}`}>
              <header className="q-head">
                <h3>Питання {i + 1}</h3>
                {done && <span className={`q-mark ${x.right ? 'is-right' : 'is-wrong'}`}>{x.right ? 'Правильно' : 'Помилка'}</span>}
              </header>
              <p className="q-text">{x.text}</p>
              {x.image && <img className="q-img" src={imageUrl(x.image)} alt={`Картинка до питання ${i + 1}`} />}
              {x.multiple && !done && <p className="muted small">Кілька правильних відповідей</p>}
              <div className="q-opts" role={x.multiple ? 'group' : 'radiogroup'} aria-label={`Варіанти питання ${i + 1}`}>
                {x.options.map((o) => {
                  const on = chosen.includes(o.id);
                  // Після здачі (і для менеджера) видно правильні варіанти та помилкові вибори учня.
                  const review = done || !isStudent;
                  const mark = review ? (o.correct ? 'tick' : on ? 'cross' : null) : on ? 'tick' : null;
                  const cls = [on && 'is-on', review && o.correct && 'is-correct', review && on && !o.correct && 'is-miss'].filter(Boolean).join(' ');
                  return (
                    <button key={o.id} type="button" className={`q-opt ${x.multiple ? 'is-multi' : ''} ${cls}`}
                      role={x.multiple ? 'checkbox' : 'radio'} aria-checked={on} disabled={review}
                      onClick={() => pick(x, o.id)}>
                      <span className="q-box" aria-hidden="true">{mark === 'tick' ? <IconTick size={14} /> : mark === 'cross' ? <IconClose size={14} /> : null}</span>
                      <span>{o.text}</span>
                      {review && on && <span className="sr">, обрано учнем</span>}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
      {!done && isStudent && (
        <div className="quiz-submit">
          <span className="muted small">Відповіли на {answered} з {a.questions.length}</span>
          <Button busy={busy} icon={<IconRight size={18} />} onClick={submit}>Здати тест</Button>
        </div>
      )}
    </>
  );
}
