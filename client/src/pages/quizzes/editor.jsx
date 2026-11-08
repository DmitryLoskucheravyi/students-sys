/* Редактор тесту: вручну або з відповіді зовнішнього ШІ. */
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, uploadForm, useData } from '../../api.js';
import { useAuth } from '../../session.jsx';
import { Button, Checkbox, ErrorNote, IconButton, Input, Loader, Modal, PageHead, Textarea, useAction, useUI } from '../../ui.jsx';
import { IconClose, IconCopy, IconDown, IconImage, IconLeft, IconPlus, IconSpark, IconTick, IconTrash, IconUp } from '../../icons.jsx';
import { MAX_OPTIONS, MAX_QUESTIONS, MIN_OPTIONS, QUIZ_PROMPT, parseQuizAnswer } from '../../quizImport.js';
import { questionsWord, imageUrl } from './common.js';

let seq = 0;
const key = () => `k${++seq}`;
const blankOption = () => ({ key: key(), text: '', correct: false });
const blankQuestion = () => ({ key: key(), text: '', image: null, options: Array.from({ length: 4 }, blankOption) });
const fromServer = (questions) => questions.map((x) => ({
  key: key(), id: x.id, text: x.text, image: x.image,
  options: x.options.map((o) => ({ key: key(), id: o.id, text: o.text, correct: Boolean(o.correct) })),
}));

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
