import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, uploadForm, useData } from '../api.js';
import { useAuth } from '../session.jsx';
import { Button, Checkbox, DatePicker, Empty, ErrorNote, IconButton, Input, LateTag, Linkify, Loader, Modal, PageHead, Select, Status, Textarea, TimePicker, useAction, useUI } from '../ui.jsx';
import { Who } from '../avatars.jsx';
import Login from './Login.jsx';
import { sfx } from '../sound.js';
import { CodeText } from '../codeText.jsx';
import { IconClose, IconCopy, IconDown, IconEdit, IconExternal, IconImage, IconLeft, IconPlus, IconQuiz, IconRestore, IconRight, IconSpark, IconTick, IconTrash, IconUp, IconUser } from '../icons.jsx';
import { dateTimeShort, isLate, nowLocal, plural, time } from '../fmt.js';
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

/** Стан модерації тесту вчителя. */
export const QUIZ_STATUS = { approved: ['completed', 'Схвалено'], pending: ['warn', 'На модерації'], rejected: ['cancelled', 'Відхилено'] };

/* Тести (вкладка на сторінці завдань). Менеджер: модерація тестів вчителів і загальний список. Вчитель: власні тести. */
export function QuizList({ isManager }) {
  const { data, loading, error, reload } = useData('/quizzes');
  const navigate = useNavigate();
  const [run] = useAction();
  if (error) return <ErrorNote text={error} onRetry={reload} />;
  if (!data) return loading ? <Loader /> : null;
  if (!data.length) {
    return <Empty icon={<IconQuiz size={36} />} title={isManager ? 'Тестів ще немає' : 'Ви ще не створили тестів'}
      action={<Button icon={<IconPlus size={18} />} onClick={() => navigate('/quizzes/new')}>Створити тест</Button>} />;
  }
  const approve = async (z) => { if (await run(() => api(`/quizzes/${z.id}/approve`, { method: 'POST' }), 'Тест схвалено')) { reload(); notify(); } };
  const row = (z, extra) => (
    <li key={z.id} className="quiz-li">
      <Link className="row row-link quiz-row" to={`/quizzes/${z.id}`}>
        <span className="quiz-ico"><IconQuiz size={20} /></span>
        <div className="row-main">
          <h3>{z.title}</h3>
          <p className="muted small">{[questionsWord(z.questions_count), isManager && z.author_role === 'teacher' && `автор: ${z.author_name}`].filter(Boolean).join(' · ')}</p>
          {z.status === 'rejected' && z.review_note && <p className="small text-red">Причина: {z.review_note}</p>}
        </div>
        {isManager && z.status === 'approved'
          ? <span className="small muted">{z.assigned_count ? `Пройшли ${z.done_count} з ${z.assigned_count}` : 'Ще нікому не відкрито'}</span>
          : <Status kind={QUIZ_STATUS[z.status][0]}>{QUIZ_STATUS[z.status][1]}</Status>}
      </Link>
      {extra}
    </li>
  );
  if (!isManager) return <ul className="rows">{data.map((z) => row(z))}</ul>;
  const pending = data.filter((z) => z.status === 'pending');
  const general = data.filter((z) => z.status === 'approved');
  return (
    <>
      {pending.length > 0 && (
        <section className="hw-group moderation" aria-label="Тести на модерації">
          <h2>На модерації <span className="count">{pending.length}</span></h2>
          <p className="muted small">Тести вчителів. Учні побачать їх лише після схвалення.</p>
          <ul className="rows">
            {pending.map((z) => row(z, (
              <div className="row-actions moderation-actions">
                <Button small icon={<IconTick size={16} />} onClick={() => approve(z)}>Схвалити</Button>
                <Button small variant="ghost" onClick={() => navigate(`/quizzes/${z.id}`)}>Переглянути</Button>
              </div>
            )))}
          </ul>
        </section>
      )}
      <section className="hw-group" aria-label="Усі тести">
        {pending.length > 0 && <h2>Усі тести</h2>}
        {general.length ? <ul className="rows">{general.map((z) => row(z))}</ul> : <p className="muted small">Схвалених тестів ще немає.</p>}
      </section>
    </>
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
  const { user } = useAuth();
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
    const teacher = user.role === 'teacher';
    const r = await run(() => (quiz ? api(`/quizzes/${quiz.id}`, { method: 'PUT', body }) : api('/quizzes', { method: 'POST', body })),
      teacher ? 'Тест надіслано на модерацію' : quiz ? 'Тест збережено' : 'Тест створено');
    if (r) navigate(`/quizzes/${quiz?.id ?? r.id}`);
  };

  return (
    <>
      <Link to={quiz ? `/quizzes/${quiz.id}` : '/homework?tab=quizzes'} className="back"><IconLeft size={18} /> {quiz ? quiz.title : 'Тести'}</Link>
      <PageHead title={quiz ? 'Редагувати тест' : 'Новий тест'}>
        <Button variant="ghost" icon={<IconSpark size={18} />} onClick={() => setAiOpen(true)}>Вставити з ШІ</Button>
      </PageHead>
      {user.role === 'teacher' && <p className="note small">Ваш тест перевірить менеджер. Після схвалення він з’явиться в загальному списку тестів.</p>}
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
      <Textarea label="Питання" hint="Код обгорніть у ^^…^^: він підсвітиться, як у редакторі" required rows={2} maxLength={2000} value={q.text} onChange={(e) => onChange({ text: e.target.value })} />
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
              <p className="muted small">ChatGPT, Gemini, Claude чи інший. Після промпту вставте конспект або тему уроку. Відповідь копіюйте кнопкою копіювання над блоком коду.</p>
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
            {result.unmarked > 0 && (
              <p className="small qi-warn">
                У {result.unmarked} {result.unmarked % 10 === 1 && result.unmarked % 100 !== 11 ? 'питанні' : 'питаннях'} немає позначок «+» і «−»: схоже, вони загубились під час копіювання з чату.
                Питання й варіанти розставимо, а правильні відповіді позначте в редакторі. Щоб не позначати вручну, скопіюйте відповідь кнопкою над блоком коду.
              </p>
            )}
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
        <Textarea label="Що виправити" hint="Вчитель побачить це поруч із тестом" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
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
        <Select label="Курс" hint="Необов’язково: підпис у списку тестів учня" value={courseId} clearable placeholder="Без курсу"
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

/**
 * Питання тесту з варіантами. До здачі учень обирає відповіді; після здачі (review) видно правильні
 * варіанти й помилкові вибори. Спільне для тесту учня і тесту за публічним посиланням.
 */
function QuizQuestions({ questions, done, review, answers, onPick, image }) {
  return (
    <ol className="q-take">
      {questions.map((x, i) => {
        const chosen = done ? x.chosen : answers[x.id] ?? [];
        return (
          <li key={x.id} className={`q-card ${done ? (x.right ? 'is-right' : 'is-wrong') : ''}`}>
            <header className="q-head">
              <h3>Питання {i + 1}</h3>
              {done && <span className={`q-mark ${x.right ? 'is-right' : 'is-wrong'}`}>{x.right ? 'Правильно' : 'Помилка'}</span>}
            </header>
            <div className="q-text"><CodeText text={x.text} kind="question" /></div>
            {x.image && <img className="q-img" src={image(x.image)} alt={`Картинка до питання ${i + 1}`} />}
            {x.multiple && !done && <p className="muted small">Кілька правильних відповідей</p>}
            <div className="q-opts" role={x.multiple ? 'group' : 'radiogroup'} aria-label={`Варіанти питання ${i + 1}`}>
              {x.options.map((o) => {
                const on = chosen.includes(o.id);
                const mark = review ? (o.correct ? 'tick' : on ? 'cross' : null) : on ? 'tick' : null;
                const cls = [on && 'is-on', review && o.correct && 'is-correct', review && on && !o.correct && 'is-miss'].filter(Boolean).join(' ');
                return (
                  <button key={o.id} type="button" className={`q-opt ${x.multiple ? 'is-multi' : ''} ${cls}`}
                    role={x.multiple ? 'checkbox' : 'radio'} aria-checked={on} disabled={review}
                    onClick={() => onPick(x, o.id)}>
                    <span className="q-box" aria-hidden="true">{mark === 'tick' ? <IconTick size={14} /> : mark === 'cross' ? <IconClose size={14} /> : null}</span>
                    <span><CodeText text={o.text} /></span>
                    {review && on && done && <span className="q-yours">ваш вибір</span>}
                    {review && on && !done && <span className="sr">, обрано</span>}
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const pickIn = (answers, x, optionId) => {
  const cur = answers[x.id] ?? [];
  return { ...answers, [x.id]: x.multiple ? (cur.includes(optionId) ? cur.filter((v) => v !== optionId) : [...cur, optionId]) : [optionId] };
};

/** Текст тесту не копіюється: ні виділенням, ні контекстним меню, ні перетягуванням. */
const noCopy = {
  onCopy: (e) => e.preventDefault(),
  onCut: (e) => e.preventDefault(),
  onContextMenu: (e) => e.preventDefault(),
  onDragStart: (e) => e.preventDefault(),
};

const LETTERS = 'ABCDEF';

/**
 * Проходження тесту по одному питанню. Одиночний вибір сам переходить далі; кілька відповідей — кнопкою «Далі».
 * Можна пропустити питання й повернутися назад, перейти до будь-якого через крапки вгорі.
 * Правильні відповіді не показуються: їх видно лише після «Завершити тест».
 * Клавіші: 1–6 обирають варіант, ← і → гортають, Enter — далі.
 */
function QuizRunner({ questions, image, busy, onFinish }) {
  const [answers, setAnswers] = useState({});
  const [i, setI] = useState(0);
  const [dir, setDir] = useState('next');
  const [skipped, setSkipped] = useState(() => new Set());
  const timer = useRef(0);
  const { confirm } = useUI();
  const x = questions[i];
  const last = i === questions.length - 1;
  const has = (q) => Boolean(answers[q.id]?.length);
  const answered = questions.filter(has).length;

  const go = (to, how) => {
    clearTimeout(timer.current);
    if (to < 0 || to >= questions.length || to === i) return;
    setDir(to > i ? 'next' : 'prev');
    setI(to);
    (how === 'skip' ? sfx.skip : to > i ? sfx.next : sfx.back)();
  };
  const next = () => {
    if (!has(x)) setSkipped((s) => new Set(s).add(x.id));
    go(i + 1, has(x) ? 'next' : 'skip');
  };
  const pick = (o) => {
    const on = (answers[x.id] ?? []).includes(o.id);
    const nextAnswers = pickIn(answers, x, o.id);
    setAnswers(nextAnswers);
    setSkipped((s) => { const n = new Set(s); n.delete(x.id); return n; });
    (on && x.multiple ? sfx.unpick : sfx.pick)();
    // Одиночний вибір: коротка пауза, щоб побачити позначку, і далі.
    clearTimeout(timer.current);
    if (!x.multiple && !last) timer.current = setTimeout(() => { setDir('next'); setI((k) => k + 1); sfx.next(); }, 420);
  };
  const finish = async () => {
    clearTimeout(timer.current);
    const left = questions.length - answered;
    if (left > 0) {
      const yes = await confirm({ title: 'Завершити тест?', text: `Без відповіді ${left} ${plural(left, 'питання', 'питання', 'питань')}. Їх буде зараховано як неправильні.`, action: 'Завершити' });
      if (!yes) return;
    }
    onFinish(answers);
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, .modal')) return;
      const k = Number(e.key);
      if (k >= 1 && k <= x.options.length) { e.preventDefault(); pick(x.options[k - 1]); }
      else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !e.target.closest?.('button'))) { e.preventDefault(); if (last) finish(); else next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const chosen = answers[x.id] ?? [];
  return (
    <div className="qr" {...noCopy}>
      <div className="qr-top">
        <span className="qr-count">Питання <b>{i + 1}</b> з {questions.length}</span>
      </div>
      <ol className="qr-dots" aria-label="Питання тесту">
        {questions.map((q, k) => (
          <li key={q.id}>
            <button type="button" className={`qr-dot ${k === i ? 'is-current' : ''} ${has(q) ? 'is-done' : skipped.has(q.id) ? 'is-skipped' : ''}`}
              aria-label={`Питання ${k + 1}${has(q) ? ', є відповідь' : skipped.has(q.id) ? ', пропущено' : ''}`} aria-current={k === i ? 'step' : undefined}
              onClick={() => go(k)}>{k + 1}</button>
          </li>
        ))}
      </ol>

      <div className="qr-stage">
        <article key={x.id} className={`q-card qr-card is-${dir}`} aria-live="polite">
          <header className="q-head">
            <h3>Питання {i + 1}</h3>
            {x.multiple && <span className="qr-multi">Кілька правильних</span>}
          </header>
          <div className="q-text"><CodeText text={x.text} kind="question" /></div>
          {x.image && <img className="q-img" src={image(x.image)} alt={`Картинка до питання ${i + 1}`} draggable="false" />}
          <div className="q-opts" role={x.multiple ? 'group' : 'radiogroup'} aria-label={`Варіанти питання ${i + 1}`}>
            {x.options.map((o, k) => {
              const on = chosen.includes(o.id);
              return (
                <button key={o.id} type="button" style={{ '--k': k }} className={`q-opt qr-opt ${x.multiple ? 'is-multi' : ''} ${on ? 'is-on' : ''}`}
                  role={x.multiple ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => pick(o)}>
                  <span className="qr-key" aria-hidden="true">{on ? <IconTick size={14} /> : LETTERS[k]}</span>
                  <span><CodeText text={o.text} /></span>
                </button>
              );
            })}
          </div>
        </article>
      </div>

      <div className="quiz-submit qr-nav">
        <Button variant="ghost" icon={<IconLeft size={18} />} disabled={i === 0} onClick={() => go(i - 1)}>Назад</Button>
        {last
          ? <Button busy={busy} icon={<IconTick size={18} />} onClick={finish}>Завершити тест</Button>
          : has(x)
            ? <Button icon={<IconRight size={18} />} onClick={next}>Далі</Button>
            : <Button variant="ghost" icon={<IconRight size={18} />} onClick={next}>Пропустити</Button>}
      </div>
    </div>
  );
}

/** Результат: кільце з часткою правильних, бал і короткий відгук. Звук і конфеті — один раз при показі. */
function ResultHero({ score, max, fresh, children }) {
  const share = max ? score / max : 0;
  const good = share >= 0.5;
  const title = share === 1 ? 'Ідеально!' : share >= 0.8 ? 'Чудовий результат' : good ? 'Добре, так тримати' : 'Варто повторити тему';
  useEffect(() => { if (fresh) (good ? sfx.win : sfx.soft)(); }, [fresh, good]);
  return (
    <section className={`quiz-score qr-result ${good ? 'is-good' : 'is-low'} ${fresh ? 'is-fresh' : ''}`} aria-label="Результат">
      {fresh && share >= 0.8 && (
        <div className="qr-confetti" aria-hidden="true">
          {Array.from({ length: 18 }, (_, k) => <i key={k} style={{ '--x': `${(k * 37) % 100}%`, '--d': `${(k % 6) * 90}ms`, '--r': `${(k * 47) % 360}deg`, '--c': k % 3 }} />)}
        </div>
      )}
      <div className="qr-dial">
        <svg className="qr-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="52" className="qr-ring-bg" />
          <circle cx="60" cy="60" r="52" className="qr-ring-fg" pathLength="1" style={{ '--share': share }} />
        </svg>
        <div className="qr-score">
          <strong>{score}<small> з {max}</small></strong>
          <span>{Math.round(share * 100)}%</span>
        </div>
      </div>
      <div className="qr-verdict">
        <h2>{title}</h2>
        <p>{Math.round(share * 100)}% правильних відповідей</p>
        {children}
      </div>
    </section>
  );
}

/** Розбір після завершення: усі питання з правильними відповідями й позначкою «правильно / помилка». */
function QuizReview({ questions, image }) {
  return (
    <section className="qr-review" {...noCopy}>
      <h2>Відповіді</h2>
      <QuizQuestions questions={questions} done review answers={{}} onPick={() => {}} image={image} />
    </section>
  );
}

/*
 * Тест за публічним посиланням /q/:token. Відкривається без входу.
 * Учень, що увійшов, записує результат у свої тести; гість чи співробітник лише бачить бал і правильні відповіді.
 */
export function PublicQuiz() {
  const { token } = useParams();
  const { user, setUser } = useAuth();
  const { data: z, loading, error, reload } = useData(`/public/quizzes/${token}?u=${user?.id ?? 0}`);
  const [result, setResult] = useState(null);
  const [round, setRound] = useState(0);
  const [signIn, setSignIn] = useState(false);
  const [run, busy] = useAction();
  const image = (name) => `/api/public/quizzes/${token}/images/${name}`;

  if (signIn && !user) return <Login onLogin={(u) => { setUser(u); setSignIn(false); setResult(null); setRound((n) => n + 1); }} />;
  if (error) return <div className="pq"><PublicHead /><ErrorNote text={error} onRetry={reload} /></div>;
  if (!z) return loading ? <Loader /> : null;

  const finish = async (answers) => {
    const r = await run(() => api(`/public/quizzes/${token}/check`, { method: 'POST', body: { answers } }));
    if (r) { setResult(r); if (r.recorded) notify(); window.scrollTo({ top: 0 }); }
  };
  const again = () => { setResult(null); setRound((n) => n + 1); window.scrollTo({ top: 0 }); };

  return (
    <div className="pq" {...noCopy}>
      <PublicHead />
      <h1 className="pq-title">{z.title}</h1>
      <p className="muted small">{questionsWord(z.questions.length)}</p>
      {z.description && !result && <p className="task"><Linkify text={z.description} /></p>}

      {result ? (
        <>
          <ResultHero score={result.score} max={result.max_score} fresh>
            <p className="small">
              {result.recorded ? <>Результат записано у ваші тести.{result.assignment_id && <> <Link to={`/tests/${result.assignment_id}`}>Відкрити</Link></>}</>
                : result.already ? 'Ви вже проходили цей тест, тому записано перший результат. Цю спробу не збережено.'
                : user ? 'Результат ніде не зберігається: записується лише для учнів.'
                : 'Результат ніде не зберігається. Увійдіть як учень, щоб він записався.'}
            </p>
            <div className="qr-actions">
              {!result.recorded && <Button variant="ghost" small icon={<IconRestore size={16} />} onClick={again}>Пройти ще раз</Button>}
              {user ? <Link className="btn btn-primary btn-small" to="/">До застосунку</Link> : <Button small onClick={() => setSignIn(true)}>Увійти</Button>}
            </div>
          </ResultHero>
          <QuizReview questions={result.questions} image={image} />
        </>
      ) : (
        <>
          <QuizRunner key={round} questions={z.questions} image={image} busy={busy} onFinish={finish} />
        </>
      )}
    </div>
  );
}

function PublicHead() {
  return (
    <header className="pq-head">
      <span className="wordmark" role="img" aria-label="Be Smart School">
        <span className="wordmark-full">
          <span className="wordmark-be">BE</span>
          <span className="wordmark-stack"><span>Smart</span><span>School</span></span>
        </span>
      </span>
    </header>
  );
}

/** Посилання на тест: вмикається тут, скопіювати й надіслати будь-кому. */
function ShareForm({ quiz, onClose, onChange }) {
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
        <p className="muted small">Пройти тест за посиланням може будь-хто, навіть без акаунта, і одразу побачить результат.
          Записується лише результат учня, який увійшов.</p>
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

/* Проходження тесту учнем і перегляд результату */
export function QuizTake() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: a, loading, error, reload } = useData(`/quizzes/assignments/${id}`);
  const [fresh, setFresh] = useState(false);
  const [run, busy] = useAction();
  const isStudent = user.role === 'student';
  const back = isStudent ? '/homework' : a ? `/quizzes/${a.quiz_id}` : '/homework';

  if (error) return <><Link to="/homework" className="back"><IconLeft size={18} /> Завдання</Link><ErrorNote text={error} onRetry={reload} /></>;
  if (!a) return loading ? <Loader /> : null;

  const done = Boolean(a.submitted_at);
  const finish = async (answers) => {
    const r = await run(() => api(`/quizzes/assignments/${a.id}/submit`, { method: 'POST', body: { answers } }), 'Тест здано');
    if (r) { notify(); setFresh(true); reload(); window.scrollTo({ top: 0 }); }
  };

  return (
    <div {...noCopy}>
      <Link to={back} className="back"><IconLeft size={18} /> {isStudent ? 'Завдання' : a.quiz_title}</Link>
      <PageHead title={a.quiz_title} />
      <p className="muted small">
        {[!isStudent && a.student_name, a.course_title, questionsWord(a.questions.length), a.due_at && !done && `пройти до ${dateTimeShort(a.due_at)}`].filter(Boolean).join(' · ')}
      </p>
      {a.description && !done && <p className="task"><Linkify text={a.description} /></p>}

      {done && (
        <>
          <ResultHero score={a.score} max={a.max_score} fresh={fresh}>
            <p className="small">Пройдено {dateTimeShort(a.submitted_at)}{isLate(a.submitted_at, a.due_at) && <> <LateTag /></>}</p>
          </ResultHero>
          <QuizReview questions={a.questions} image={imageUrl} />
        </>
      )}
      {!done && !isStudent && (
        <>
          <p className="note small">Учень ще не пройшов тест. Правильні відповіді позначено.</p>
          <QuizQuestions questions={a.questions} done={false} review answers={{}} onPick={() => {}} image={imageUrl} />
        </>
      )}
      {!done && isStudent && <QuizRunner questions={a.questions} image={imageUrl} busy={busy} onFinish={finish} />}
    </div>
  );
}
