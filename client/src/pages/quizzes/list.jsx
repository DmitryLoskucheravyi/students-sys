/* Списки тестів: учня на сторінці завдань, менеджера з модерацією, вчителя з його тестами. */
import { Link, useNavigate } from 'react-router-dom';
import { api, useData } from '../../api.js';
import { Button, Empty, ErrorNote, LateTag, Loader, Status, useAction } from '../../ui.jsx';
import { IconPlus, IconQuiz, IconTick } from '../../icons.jsx';
import { dateTimeShort, isLate, nowLocal } from '../../fmt.js';
import { notify, questionsWord } from './common.js';

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
