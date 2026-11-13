/* Проходження тесту учнем і перегляд результату. */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, useData } from '../../api.js';
import { useAuth } from '../../session.jsx';
import { ErrorNote, Linkify, Loader, PageHead, useAction } from '../../ui.jsx';
import { IconLeft } from '../../icons.jsx';
import { dateTimeShort } from '../../fmt.js';
import { notify, questionsWord, imageUrl } from './common.js';
import { QuizQuestions, QuizReview, QuizRunner, ResultHero, noCopy } from './runner.jsx';

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
      {/* Після здачі — лише бал (співробітнику ще ім'я учня); до здачі коротко: курс, кількість питань, термін */}
      {(!done || !isStudent) && (
        <p className="muted small">
          {(done ? [a.student_name] : [!isStudent && a.student_name, a.course_title, questionsWord(a.questions.length), a.due_at && `пройти до ${dateTimeShort(a.due_at)}`]).filter(Boolean).join(', ')}
        </p>
      )}
      {a.description && !done && <p className="task"><Linkify text={a.description} /></p>}

      {done && (
        <>
          <ResultHero score={a.score} max={a.max_score} fresh={fresh} />
          <QuizReview questions={a.questions} image={imageUrl} />
        </>
      )}
      {!done && !isStudent && (
        <>
          <QuizQuestions questions={a.questions} done={false} review answers={{}} onPick={() => {}} image={imageUrl} />
        </>
      )}
      {!done && isStudent && <QuizRunner questions={a.questions} image={imageUrl} busy={busy} onFinish={finish} />}
    </div>
  );
}
