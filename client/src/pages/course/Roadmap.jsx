/* Роадмап: серпантин на всю ширину з етапами, підтемами й домашніми. */
import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../../session.jsx';
import { Checkbox, Collapse, Status } from '../../ui.jsx';
import { IconDown, IconHomework, IconTick } from '../../icons.jsx';
import { dateTimeShort, nowLocal } from '../../fmt.js';
import { HW_STATUS } from '../Homework.jsx';
import { stepShare, hwState } from './progress.js';

/** Домашні під етапом роадмапу: назва, підтема, термін і стан для обраного учня. */
function StepHomework({ items, step, viewerId }) {
  if (!items.length) return null;
  const now = nowLocal();
  return (
    <ul className="road-hw" aria-label={`Домашні етапу «${step.title}»`}>
      {items.map((h) => {
        const subTitles = h.topics
          .filter((t) => t.step_id === step.id && t.substep_id)
          .map((t) => step.substeps.find((x) => x.id === t.substep_id)?.title)
          .filter(Boolean);
        const st = hwState(h, viewerId);
        const late = st && st !== 'accepted' && st !== 'submitted' && h.due_at < now;
        return (
          <li key={h.id}>
            <Link to={`/homework/${h.id}`} className="road-hw-item">
              <IconHomework size={16} />
              <span className="road-hw-title">
                {h.title}
                {subTitles.length > 0 && <small className="muted"> · {subTitles.join(', ')}</small>}
              </span>
              <small className={late ? 'text-red' : 'muted'}>до {dateTimeShort(h.due_at)}</small>
              {st && <Status kind={HW_STATUS[st][0]}>{HW_STATUS[st][1]}</Status>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Геометрія дороги. Має збігатися з .stop у styles.css.
 * Телефон: дорога в’ється вздовж лівого краю. Широкий екран: серпантин на всю ширину,
 * кружки чергуються біля лівого й правого краю, а між етапами дорога перетинає сторінку.
 */
const ROAD = {
  mobile: { x: [24, 50], radius: 22 },
  wide: { radius: 36 },
};
const MAX_PIPS = 10;

/** Кільце навколо кружка: частка пройдених підпунктів. */
function StopRing({ fraction }) {
  return (
    <svg className="stop-ring" viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r="24" pathLength="1" style={{ strokeDasharray: `${fraction} 1`, strokeOpacity: fraction > 0 ? 1 : 0 }} />
    </svg>
  );
}

export function SubToggle({ open, done, total, onClick, label }) {
  return (
    <button type="button" className={`sub-toggle ${open ? 'is-open' : ''}`} aria-expanded={open} onClick={onClick}>
      {done != null && total <= MAX_PIPS && (
        <span className="pips" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => <i key={i} className={i < done ? 'is-on' : ''} />)}
        </span>
      )}
      <span>{label}</span>
      <IconDown size={16} className="chev" />
    </button>
  );
}

/** Прапорець фінішу. */
const IconFlag = ({ size }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 21V4" /><path d="M5 4.5c4-2 7 2 13 0v9c-6 2-9-2-13 0" />
  </svg>
);

/** Відрізок серпантину: вниз уздовж краю, плавний поворот, перетин сторінки, поворот, вниз до кружка. */
function switchback(x0, y0, x1, y1, yc) {
  const s = Math.sign(x1 - x0) || 1;
  const t = Math.max(0, Math.min(72, yc - y0, y1 - yc, Math.abs(x1 - x0) / 2));
  const k = t * 0.45;
  return `M${x0} ${y0} L${x0} ${yc - t} C${x0} ${yc - k}, ${x0 + s * k} ${yc}, ${x0 + s * t} ${yc}`
    + ` L${x1 - s * t} ${yc} C${x1 - s * k} ${yc}, ${x1} ${yc + k}, ${x1} ${yc + t} L${x1} ${y1}`;
}
const wave = (x0, y0, x1, y1) => {
  const mid = (y1 - y0) / 2;
  return `M${x0} ${y0} C${x0} ${y0 + mid}, ${x1} ${y1 - mid}, ${x1} ${y1}`;
};

/** Звивиста дорога. Висота рядків залежить від підпунктів, тому точки вимірюємо з DOM. */
export function RoadmapPath({ steps, doneIds, doneSubs, canMark, onToggleStep, onToggleSub, homework = [], viewerId = null }) {
  const mobile = useIsMobile();
  const geo = mobile ? ROAD.mobile : ROAD.wide;
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const finishRef = useRef(null);
  const [box, setBox] = useState(null);
  const [overrides, setOverrides] = useState({});
  const measureRef = useRef(null);
  const followUntil = useRef(0);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    const measure = () => {
      const rows = [...el.children].map((row) => {
        const stop = row.querySelector('.stop');
        const card = row.querySelector('.road-text');
        return {
          y: row.offsetTop + stop.offsetTop + stop.offsetHeight / 2,
          x: stop.offsetLeft + stop.offsetWidth / 2,
          cardBottom: row.offsetTop + card.offsetTop + card.offsetHeight,
          top: row.offsetTop,
        };
      });
      const f = finishRef.current;
      const flag = f?.querySelector('.road-flag');
      const finish = flag ? { x: f.offsetLeft + flag.offsetLeft + flag.offsetWidth / 2, y: f.offsetTop + flag.offsetTop + flag.offsetHeight / 2 } : null;
      setBox({ rows, finish });
    };
    measureRef.current = measure;
    measure();
    // Спрацьовує щокадру під час розгортання, тому дорога рухається разом із рядками.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (rootRef.current) observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [steps.length, mobile]);

  // Під час розгортання етапу перемірюємо дорогу щокадру, доки йде анімація: вона тягнеться плавно, без ривка в кінці.
  const follow = () => {
    const running = followUntil.current > performance.now();
    followUntil.current = performance.now() + 480;
    if (running) return;
    const tick = () => {
      measureRef.current?.();
      if (performance.now() < followUntil.current) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const firstOpen = steps.findIndex((s) => !doneIds.has(s.id));
  const allDone = firstOpen === -1;
  const ready = box && box.rows.length === steps.length && steps.length > 0;

  const piece = (a, b) => {
    if (mobile) return wave(a.x, a.y, b.x, b.y);
    // Середина проміжку між карткою і наступним етапом: тут дорога перетинає сторінку.
    const yc = (Math.max(a.cardBottom, a.y + 40) + b.top) / 2;
    return switchback(a.x, a.y, b.x, b.y, Math.min(yc, b.y - 24));
  };
  // Пройдена частина: від пройденого етапу дорога заливається до наступного на його частку.
  const fill = (i) => {
    if (!doneIds.has(steps[i].id)) return 0;
    const next = steps[i + 1];
    return doneIds.has(next.id) ? 1 : Math.max(stepShare(next, doneIds, doneSubs), 0.5);
  };
  const segments = ready
    ? steps.slice(0, -1).map((s, i) => ({ id: s.id, d: piece(box.rows[i], box.rows[i + 1]), fill: fill(i), full: doneIds.has(s.id) && doneIds.has(steps[i + 1].id) }))
    : [];
  const last = ready ? box.rows[box.rows.length - 1] : null;
  const tail = ready && box.finish
    ? (mobile
      ? wave(last.x, last.y, box.finish.x, box.finish.y)
      : switchback(last.x, last.y, box.finish.x, box.finish.y, Math.min((Math.max(last.cardBottom, last.y + 40) + box.finish.y - 40) / 2, box.finish.y - 24)))
    : null;
  const lastDone = steps.length > 0 && doneIds.has(steps[steps.length - 1].id);

  return (
    <div ref={rootRef} className={`road ${ready ? 'is-ready' : ''}`} style={mobile ? { '--road-text': `${geo.x[1] + geo.radius + 14}px` } : undefined}>
      <svg className="road-line" width="100%" height="100%" aria-hidden="true">
        <g className="road-edge">{segments.map((s) => <path key={s.id} d={s.d} />)}{tail && <path d={tail} />}</g>
        <g className="road-bed">{segments.map((s) => <path key={s.id} d={s.d} />)}</g>
        {tail && <path className="road-tail" d={tail} />}
        <g>
          {segments.map((s) => (
            <path key={s.id} d={s.d} pathLength="1" className={`road-done ${s.full ? 'is-done' : ''}`}
              style={{ strokeDashoffset: 1 - s.fill, opacity: s.fill > 0 ? 1 : 0 }} />
          ))}
          {tail && <path d={tail} pathLength="1" className={`road-done ${allDone ? 'is-done' : ''}`}
            style={{ strokeDashoffset: lastDone ? 0 : 1, opacity: lastDone ? 1 : 0 }} />}
        </g>
      </svg>
      <ol ref={listRef} className="road-list">
        {steps.map((s, i) => {
          const done = doneIds.has(s.id);
          const current = i === firstOpen;
          const total = s.substeps.length;
          const subsDone = s.substeps.filter((x) => doneSubs.has(x.id)).length;
          const open = overrides[s.id] ?? current;
          const cls = `stop ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`;
          const left = mobile ? geo.x[i % 2] - geo.radius : undefined;
          const label = `${s.title}: ${done ? 'пройдено' : total ? `пройдено ${subsDone} із ${total}` : 'не пройдено'}`;
          const inner = (
            <>
              {total > 0 && !done && <StopRing fraction={subsDone / total} />}
              {done ? <IconTick size={mobile ? 20 : 28} /> : i + 1}
            </>
          );
          const state = done ? 'Пройдено' : current ? 'Ви тут' : 'Попереду';
          const pct = done ? 100 : total ? Math.round((subsDone / total) * 100) : 0;
          return (
            <li key={s.id} className={`road-row ${i % 2 ? 'is-right' : 'is-left'} ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`} style={{ '--i': Math.min(i, 10) }}>
              {canMark ? (
                <button type="button" className={cls} style={{ left }} aria-pressed={done} aria-label={label}
                  title={done ? 'Зняти позначку' : 'Позначити пройденим'} onClick={() => onToggleStep(s, !done, subsDone)}>{inner}</button>
              ) : (
                <span className={cls} style={{ left }} role="img" aria-label={label}>{inner}</span>
              )}
              <span className="road-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <div className="road-text">
                <div className="road-eyebrow">
                  <span className="road-state">{state}</span>
                  {total > 0 && <span className="road-pct">{pct}%</span>}
                </div>
                <h3>{s.title}</h3>
                {s.description && <p className="road-desc">{s.description}</p>}
                {total > 0 && <span className="road-meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>}
                <StepHomework step={s} viewerId={viewerId} items={homework.filter((h) => h.topics.some((t) => t.step_id === s.id))} />
                {total > 0 && (
                  <>
                    <SubToggle open={open} done={subsDone} total={total} label={`${subsDone} із ${total}`}
                      onClick={() => { setOverrides({ ...overrides, [s.id]: !open }); follow(); }} />
                    <Collapse open={open}>
                      <ul className="subs">
                        {s.substeps.map((x, k) => {
                          const on = doneSubs.has(x.id);
                          const flowIn = s.substeps.slice(0, k + 1).every((y) => doneSubs.has(y.id));
                          const flowOut = s.substeps.slice(0, k + 2).every((y) => doneSubs.has(y.id));
                          return (
                            <li key={x.id} className={`sub ${on ? 'is-done' : ''}`} style={{ '--i': Math.min(k, 8) }}>
                              <i className={`sub-line sub-line-in ${flowIn ? 'is-on' : ''}`} />
                              {k < total - 1 && <i className={`sub-line sub-line-out ${flowOut ? 'is-on' : ''}`} />}
                              <Checkbox checked={on} readOnly={!canMark} onChange={(v) => {
                                // Остання галочка закриває етап, але список не має згортатися під рукою.
                                setOverrides((cur) => ({ ...cur, [s.id]: true }));
                                onToggleSub(x, v);
                              }}>{x.title}</Checkbox>
                            </li>
                          );
                        })}
                      </ul>
                    </Collapse>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={finishRef} className={`road-finish ${steps.length % 2 ? 'is-right' : 'is-left'} ${allDone ? 'is-done' : ''}`}
        style={mobile ? { paddingLeft: geo.x[steps.length % 2] - geo.radius } : undefined}>
        <span className="road-flag"><IconFlag size={mobile ? 20 : 28} /></span>
        <span className="road-finish-text">{allDone ? 'Курс пройдено!' : 'Фініш'}</span>
      </div>
    </div>
  );
}
