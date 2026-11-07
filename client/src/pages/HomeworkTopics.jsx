import { useState } from 'react';
import { useData } from '../api.js';
import { Checkbox, Collapse } from '../ui.jsx';
import { IconDown, IconRoadmap } from '../icons.jsx';

const keyOf = (t) => `${t.step_id}:${t.substep_id ?? ''}`;

/**
 * Вибір тем роадмапу для домашнього. Галочка на темі бере її цілком,
 * а розгорнувши тему, можна обрати лише окремі підтеми.
 * query: «schedule_id=5» або «session_id=12», щоб сервер знайшов курс уроку.
 */
export function TopicPicker({ query, value, onChange }) {
  const path = query ? `/homework/topics?${query}` : null;
  const { data, loadedPath } = useData(path);
  const [opened, setOpened] = useState({});
  // Після зміни уроку старі теми не показуємо, доки не прийдуть нові.
  if (!path || !data || loadedPath !== path || !data.steps.length) return null;

  const chosen = new Set(value.map(keyOf));
  const wholeOn = (s) => chosen.has(`${s.id}:`);
  const setWhole = (s, on) => {
    const rest = value.filter((t) => t.step_id !== s.id);
    onChange(on ? [...rest, { step_id: s.id, substep_id: null }] : rest);
  };
  const setSub = (s, x, on) => {
    const rest = value.filter((t) => !(t.step_id === s.id && (t.substep_id === x.id || t.substep_id == null)));
    // Зняли підтему з цілої теми: лишаються інші її підтеми.
    const siblings = wholeOn(s) && !on ? s.substeps.filter((y) => y.id !== x.id).map((y) => ({ step_id: s.id, substep_id: y.id })) : [];
    onChange(on ? [...rest, { step_id: s.id, substep_id: x.id }] : [...rest, ...siblings]);
  };

  return (
    <fieldset className="topics">
      <legend><IconRoadmap size={16} /> Теми з курсу «{data.course_title}»</legend>
      <p className="muted small">Домашнє з’явиться на роадмапі в цих темах.</p>
      <ul>
        {data.steps.map((s, i) => {
          const whole = wholeOn(s);
          const subsOn = s.substeps.filter((x) => whole || chosen.has(`${s.id}:${x.id}`)).length;
          const open = opened[s.id] ?? (subsOn > 0 && !whole);
          return (
            <li key={s.id} className="topic">
              <div className="topic-head">
                <Checkbox checked={whole} onChange={(on) => setWhole(s, on)}>
                  <span className="topic-num">{i + 1}.</span> {s.title}
                </Checkbox>
                {s.substeps.length > 0 && (
                  <button type="button" className={`topic-more ${open ? 'is-open' : ''}`} aria-expanded={open}
                    aria-label={`Підтеми теми «${s.title}»`} onClick={() => setOpened({ ...opened, [s.id]: !open })}>
                    {!whole && subsOn > 0 ? `${subsOn} із ${s.substeps.length}` : `Підтеми: ${s.substeps.length}`}
                    <IconDown size={14} className="chev" />
                  </button>
                )}
              </div>
              {s.substeps.length > 0 && (
                <Collapse open={open}>
                  <ul className="topic-subs">
                    {s.substeps.map((x) => (
                      <li key={x.id}>
                        <Checkbox checked={whole || chosen.has(`${s.id}:${x.id}`)} onChange={(on) => setSub(s, x, on)}>{x.title}</Checkbox>
                      </li>
                    ))}
                  </ul>
                </Collapse>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** Теми домашнього плашками: «Змінні» або «Змінні: типи даних». */
export function TopicChips({ topics }) {
  if (!topics?.length) return null;
  return (
    <ul className="topic-chips" aria-label="Теми роадмапу">
      {topics.map((t) => (
        <li key={keyOf(t)}><IconRoadmap size={14} /> {t.substep_title ? `${t.step_title}: ${t.substep_title}` : t.step_title}</li>
      ))}
    </ul>
  );
}
