/* Підсумок прогресу учня над роадмапом. */
import { plural } from '../../fmt.js';
import { stepShare, hwState } from './progress.js';

/** Підсумок для учня: скільки пройдено, де він зараз і що з домашніми курсу. */
export function ProgressCard({ steps, doneIds, doneSubs, homework, viewerId, isStudent }) {
  const share = steps.reduce((sum, s) => sum + stepShare(s, doneIds, doneSubs), 0);
  const pct = steps.length ? Math.round((share / steps.length) * 100) : 0;
  const doneSteps = steps.filter((s) => doneIds.has(s.id)).length;
  const currentIndex = steps.findIndex((s) => !doneIds.has(s.id));
  const current = steps[currentIndex];
  const states = homework.map((h) => hwState(h, viewerId));
  const accepted = states.filter((s) => s === 'accepted').length;
  const returned = states.filter((s) => s === 'returned').length;
  const open = states.filter((s) => s === 'todo').length;
  return (
    <section className="course-progress" aria-label={isStudent ? 'Мій прогрес на курсі' : 'Підсумок курсу для обраного учня'}>
      <div className="cp-main">
        <strong className="cp-pct">{pct}%</strong>
        <div className="cp-text">
          <span className="progress" role="img" aria-label={`Пройдено ${pct}%`}><i style={{ width: `${pct}%` }} /></span>
          <p className="small">
            {doneSteps === steps.length
              ? 'Усі етапи пройдено'
              : <>Пройдено {doneSteps} з {steps.length} {plural(steps.length, 'етапу', 'етапів', 'етапів')}. Зараз: <b>{currentIndex + 1}. {current.title}</b></>}
          </p>
        </div>
      </div>
      {homework.length > 0 && (
        <ul className="cp-hw" aria-label="Домашні курсу">
          <li><b>{accepted}</b> з {homework.length} домашніх прийнято</li>
          {open > 0 && <li className="is-warn">треба здати: <b>{open}</b></li>}
          {returned > 0 && <li className="is-red">на виправлення: <b>{returned}</b></li>}
        </ul>
      )}
    </section>
  );
}
