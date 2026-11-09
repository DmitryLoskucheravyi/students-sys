/* Тест за публічним посиланням. */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, useData } from '../../api.js';
import { useAuth } from '../../session.jsx';
import { Button, ErrorNote, Linkify, Loader, useAction } from '../../ui.jsx';
import BsLogo from '../../BsLogo.jsx';
import { IconRestore } from '../../icons.jsx';
import { notify } from './common.js';
import { QuizRunner, QuizReview, ResultHero, noCopy } from './runner.jsx';

/*
 * Тест за публічним посиланням /q/:token. Відкривається без входу.
 * Учень, що увійшов, записує результат у свої тести; гість чи співробітник лише бачить бал і правильні відповіді.
 * Під результатом нічого не пояснюємо: лише бал.
 */
export function PublicQuiz() {
  const { token } = useParams();
  const { user } = useAuth();
  const { data: z, loading, error, reload } = useData(`/public/quizzes/${token}?u=${user?.id ?? 0}`);
  const [result, setResult] = useState(null);
  const [round, setRound] = useState(0);
  const [run, busy] = useAction();
  const image = (name) => `/api/public/quizzes/${token}/images/${name}`;

  if (error) return <div className="pq"><ErrorNote text={error} onRetry={reload} /><PublicLogo /></div>;
  if (!z) return loading ? <Loader /> : null;

  const finish = async (answers) => {
    const r = await run(() => api(`/public/quizzes/${token}/check`, { method: 'POST', body: { answers } }));
    if (r) { setResult(r); if (r.recorded) notify(); window.scrollTo({ top: 0 }); }
  };
  const again = () => { setResult(null); setRound((n) => n + 1); window.scrollTo({ top: 0 }); };

  return (
    <div className="pq" {...noCopy}>
      <h1 className="pq-title">{z.title}</h1>
      {z.description && !result && <p className="task"><Linkify text={z.description} /></p>}

      {result ? (
        <>
          <ResultHero score={result.score} max={result.max_score} fresh>
            {!result.recorded && (
              <div className="qr-actions">
                <Button variant="ghost" small icon={<IconRestore size={16} />} onClick={again}>Пройти ще раз</Button>
              </div>
            )}
          </ResultHero>
          <QuizReview questions={result.questions} image={image} />
        </>
      ) : (
        <QuizRunner key={round} questions={z.questions} image={image} busy={busy} onFinish={finish} />
      )}
      <PublicLogo />
    </div>
  );
}

/** Логотип у нижньому лівому куті: з'являється анімовано й далі ледь «дихає». */
function PublicLogo() {
  return (
    <div className="pq-logo">
      <BsLogo className="is-corner" />
    </div>
  );
}
