import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useData } from '../api.js';
import { useAuth, useIsMobile } from '../session.jsx';
import { Button, Checkbox, DatePicker, Empty, ErrorNote, IconButton, Input, Linkify, Loader, firstUrl, Modal, PageHead, Segmented, Select, Status, TimePicker, Textarea, WeekdayPicker, useAction, useUI } from '../ui.jsx';
import { IconBan, IconClock, IconClose, IconEdit, IconExternal, IconHomework, IconLeft, IconList, IconLesson, IconMove, IconOnce, IconPeople, IconPin, IconPlus, IconRepeat, IconRestore, IconRight, IconTick, IconTicket, IconUser } from '../icons.jsx';
import { WEEKDAYS, addDays, dateTimeShort, mondayOf, money, nowLocal, parseDate, time, todayISO, weekTitle, weekdayDayMonth, weekdayOf } from '../fmt.js';

// Висота години: блок на годину вміщує назву, час, вчителя й учнів.
const HOUR_PX = 88;
const DAY_MIN = 24 * 60;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const currentMinute = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};
const STATUS = { scheduled: 'Заплановано', completed: 'Проведено', cancelled: 'Скасовано' };

export default function Schedule() {
  const { user } = useAuth();
  const isManager = user.role === 'manager';
  const isStudent = user.role === 'student';
  const today = todayISO();
  const narrow = useIsMobile();
  const [day, setDay] = useState(today);
  const monday = mondayOf(day);
  const step = narrow ? 1 : 7;
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const [teacherId, setTeacherId] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(null);

  const params = new URLSearchParams({ from: monday, to: addDays(monday, 6) });
  if (teacherId) params.set('teacher_id', teacherId);
  if (studentId) params.set('student_id', studentId);
  const sessionsPath = `/sessions?${params}`;
  const { data: sessions, loadedPath, loading, error, reload } = useData(sessionsPath);
  const ready = loadedPath === sessionsPath;
  const requests = useData(isStudent ? null : '/requests');
  const summary = useData(isStudent ? '/sessions/summary' : null);
  const people = useData(isManager ? '/users' : null);

  const refresh = () => {
    reload();
    requests.reload();
    summary.reload();
  };

  const teachers = (people.data ?? []).filter((u) => u.role === 'teacher' && u.is_active);
  const students = (people.data ?? []).filter((u) => u.role === 'student' && u.is_active);

  return (
    <>
      <PageHead title="Розклад">
        {isManager && <Button icon={<IconPlus size={18} />} onClick={() => setAdding({})}>Додати в розклад</Button>}
      </PageHead>

      {isStudent && summary.data && <StudentSummary data={summary.data} onOpen={setOpenId} />}
      {!isStudent && requests.data?.length > 0 && <Requests items={requests.data} onChange={refresh} onOpen={setOpenId} />}

      <div className="week-bar">
        <div className="week-nav">
          <IconButton label={narrow ? 'Попередній день' : 'Попередній тиждень'} onClick={() => setDay(addDays(day, -step))}><IconLeft /></IconButton>
          <strong aria-live="polite">{narrow ? weekdayDayMonth(day) : weekTitle(monday)}</strong>
          <IconButton label={narrow ? 'Наступний день' : 'Наступний тиждень'} onClick={() => setDay(addDays(day, step))}><IconRight /></IconButton>
          {(narrow ? day !== today : monday !== mondayOf(today)) && <Button variant="ghost" small onClick={() => setDay(today)}>Сьогодні</Button>}
        </div>
        {isManager && (
          <div className="week-filters">
            <Select compact placeholder="Усі вчителі" clearable="Усі вчителі" value={teacherId} onChange={setTeacherId}
              options={teachers.map((t) => ({ value: t.id, label: t.name }))} />
            <Select compact placeholder="Усі учні" clearable="Усі учні" value={studentId} onChange={setStudentId}
              options={students.map((s) => ({ value: s.id, label: s.name }))} />
          </div>
        )}
      </div>

      {error && <ErrorNote text={error} onRetry={reload} />}
      {!error && !sessions && loading && <Loader />}
      {narrow && <DayStrip monday={monday} day={day} today={today} sessions={ready ? sessions : null} onPick={setDay} />}
      {sessions && (
        <TimeGrid days={narrow ? [day] : weekDays} sessions={sessions} ready={ready} today={today} onOpen={setOpenId}
          onSlot={isManager ? (date, t) => setAdding({ date, time: t }) : null} />
      )}
      {sessions && (
        <div className="legend" aria-hidden="true">
          <span><i className="swatch swatch-weekly" />Постійний</span>
          <span><i className="swatch swatch-once" />Одноразовий</span>
          <span><i className="swatch swatch-completed" />Проведено</span>
          <span><i className="swatch swatch-cancelled" />Скасовано</span>
        </div>
      )}

      {openId && <SessionSheet id={openId} onClose={() => setOpenId(null)} onChange={refresh} />}
      {adding && <ScheduleForm preset={adding} onClose={() => setAdding(null)} onDone={() => { setAdding(null); refresh(); }} />}
    </>
  );
}

function StudentSummary({ data, onOpen }) {
  const { next, lessons_left: left, homework_todo: todo } = data;
  return (
    <section className="summary" aria-label="Коротко">
      <button type="button" className="summary-next" disabled={!next} onClick={() => next && onOpen(next.id)}>
        <small>Наступне заняття</small>
        {next ? (
          <>
            <strong>{dateTimeShort(next.starts_at)}</strong>
            <span>{next.title}</span>
          </>
        ) : <strong>Поки немає</strong>}
      </button>
      <Link to="/subscription" className={`summary-item ${left <= 1 ? 'is-alert' : ''}`}>
        <IconTicket />
        <strong>{left}</strong>
        <small>{left === 0 ? 'Абонемент закінчився' : 'Лишилось уроків'}</small>
      </Link>
      <Link to="/homework" className={`summary-item ${todo > 0 ? 'is-alert' : ''}`}>
        <IconHomework />
        <strong>{todo}</strong>
        <small>Домашніх до здачі</small>
      </Link>
    </section>
  );
}

function Requests({ items, onChange, onOpen }) {
  const [run, busy] = useAction();
  const act = async (r, decision) => {
    const ok = await run(() => api(`/requests/${r.id}/${decision}`, { method: 'POST' }), decision === 'approve' ? 'Запит схвалено' : 'Запит відхилено');
    if (ok) onChange();
  };
  return (
    <section className="requests">
      <h2>Запити учнів <span className="count">{items.length}</span></h2>
      {items.map((r) => (
        <div key={r.id} className="request">
          <button type="button" className="request-info" onClick={() => onOpen(r.session_id)}>
            <strong>{r.student_name}</strong>
            <span>
              {r.title}, {dateTimeShort(r.starts_at)}: {r.kind === 'cancel' ? 'скасувати' : `перенести на ${dateTimeShort(r.proposed_starts_at)}`}
            </span>
            {r.reason && <small>{r.reason}</small>}
          </button>
          <div className="request-actions">
            <Button variant="ghost" small busy={busy} onClick={() => act(r, 'reject')}>Відхилити</Button>
            <Button small busy={busy} onClick={() => act(r, 'approve')}>Схвалити</Button>
          </div>
        </div>
      ))}
    </section>
  );
}

/* Сітка на всю добу: зошит у клітинку. На комп'ютері сім днів, на телефоні один. */
function layoutDay(items) {
  const sorted = [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const lanes = [];
  const placed = sorted.map((s) => {
    let lane = lanes.findIndex((end) => end <= s.starts_at);
    if (lane < 0) { lane = lanes.length; lanes.push(''); }
    lanes[lane] = s.ends_at;
    return { s, lane };
  });
  return placed.map((p) => ({ ...p, lanes: lanes.length }));
}
const minutes = (dt) => Number(dt.slice(11, 13)) * 60 + Number(dt.slice(14, 16));

/** Заняття дня разом із хвостом того, що почалося напередодні й перейшло через північ. */
const sessionsOfDay = (sessions, d) => sessions.filter((s) => s.starts_at.slice(0, 10) === d
  || (s.starts_at.slice(0, 10) < d && s.ends_at > `${d} 00:00:00`));

function TimeGrid({ days, sessions, ready, today, onOpen, onSlot }) {
  const single = days.length === 1;
  const box = useRef(null);
  const scrolledFor = useRef(null);
  const [nowMin, setNowMin] = useState(currentMinute);
  const daysKey = days.join();

  useEffect(() => {
    const timer = setInterval(() => setNowMin(currentMinute()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Доба не влазить в екран: показуємо поточний час або перше заняття, а не північ.
  useLayoutEffect(() => {
    if (!ready || !box.current || scrolledFor.current === daysKey) return;
    scrolledFor.current = daysKey;
    const shown = days.flatMap((d) => sessionsOfDay(sessions, d)).filter((s) => s.status !== 'cancelled');
    const startHour = (s) => (s.starts_at.slice(0, 10) === days[0] || !single ? minutes(s.starts_at) / 60 : 0);
    let hour = 8;
    if (days.includes(today)) {
      hour = currentMinute() / 60 - 1;
      // На телефоні видно мало годин, тому беремо найближче заняття цього дня.
      const next = single ? shown.find((s) => s.ends_at > nowLocal()) : null;
      if (next) hour = startHour(next) - 0.5;
    } else if (shown.length) {
      hour = Math.min(...shown.map(startHour)) - (single ? 0.5 : 1);
    }
    box.current.scrollTop = Math.max(0, hour) * HOUR_PX;
  }, [ready, daysKey, days, single, sessions, today]);

  const clickSlot = (e, day) => {
    if (!onSlot || e.target !== e.currentTarget) return;
    const h = Math.min(23, Math.floor(e.nativeEvent.offsetY / HOUR_PX));
    onSlot(day, `${String(h).padStart(2, '0')}:00`);
  };

  return (
    <div ref={box} className={`week ${single ? 'is-single' : ''}`} style={{ '--hour': `${HOUR_PX}px`, '--days': days.length }} tabIndex={0} role="group" aria-label="Сітка розкладу">
      {!single && (
        <div className="week-head">
          <span />
          {days.map((d) => (
            <div key={d} className={`week-day ${d === today ? 'is-today' : ''}`}>
              <small>{WEEKDAYS[weekdayOf(d) - 1]}</small>
              <strong>{parseDate(d).getDate()}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="week-body" style={{ height: HOURS.length * HOUR_PX }}>
        <div className="week-hours">
          {HOURS.map((h) => <span key={h} style={{ top: h * HOUR_PX }}>{String(h).padStart(2, '0')}:00</span>)}
        </div>
        {days.map((d) => (
          <div key={d} className={`week-col ${d === today ? 'is-today' : ''} ${onSlot ? 'can-add' : ''}`} onClick={(e) => clickSlot(e, d)}>
            {layoutDay(sessionsOfDay(sessions, d)).map(({ s, lane, lanes }) => {
              const from = s.starts_at.slice(0, 10) === d ? minutes(s.starts_at) : 0;
              const to = s.ends_at.slice(0, 10) === d ? minutes(s.ends_at) : DAY_MIN;
              const top = Math.min((from / 60) * HOUR_PX, ((DAY_MIN / 60) * HOUR_PX) - (single ? 40 : 30));
              const height = Math.max(single ? 40 : 30, ((to - from) / 60) * HOUR_PX - 2);
              // Посилання відкривається прямо з сітки; для скасованого заняття воно вже не потрібне.
              const link = s.status !== 'cancelled' ? firstUrl(s.location) : null;
              const names = s.students?.map((x) => x.name).join(', ');
              return (
                <div key={s.id} className={`block ${blockClass(s)} ${height < 40 ? 'is-short' : ''} ${link ? 'has-link' : ''}`}
                  style={{ top, height, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}>
                  <button type="button" className="block-open" title={`${s.title}, ${time(s.starts_at)}–${time(s.ends_at)}`} onClick={() => onOpen(s.id)}>
                    <strong>{s.title}</strong>
                    <small>{time(s.starts_at)}–{time(s.ends_at)}{isMoved(s) ? ', перенесено' : ''}</small>
                    <small className="block-meta" title="Вчитель"><IconUser size={13} /><span>{s.teacher_name ?? 'Без вчителя'}</span></small>
                    {names !== undefined && (
                      <small className="block-meta" title="Учні"><IconPeople size={13} /><span>{names || 'Без учнів'}</span></small>
                    )}
                  </button>
                  {link && (
                    <a className="block-link" href={link} target="_blank" rel="noopener noreferrer" aria-label={`Перейти за посиланням: ${s.title}`} title="Перейти за посиланням">
                      <IconExternal size={15} />
                    </a>
                  )}
                </div>
              );
            })}
            {d === today && <i className="now-line" style={{ top: (nowMin / 60) * HOUR_PX }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
const isMoved = (s) => s.original_starts_at !== s.starts_at;
const blockClass = (s) => (s.status === 'cancelled' ? 'is-cancelled' : s.status === 'completed' ? 'is-completed' : s.kind === 'once' ? 'is-once' : 'is-weekly');

/* Перемикач днів тижня над денною сіткою */
function DayStrip({ monday, day, today, sessions, onPick }) {
  const strip = useRef(null);
  const shownDay = useRef(day);
  // Обрали інший день: піднімаємо стрічку вгору, щоб уся сітка дня влізла в екран.
  useEffect(() => {
    if (shownDay.current === day) return;
    shownDay.current = day;
    strip.current?.scrollIntoView({ block: 'start' });
  }, [day]);
  return (
    <div ref={strip} className="day-strip" role="group" aria-label="День тижня">
      {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d, i) => {
        const has = sessions?.some((s) => s.status !== 'cancelled' && sessionsOfDay([s], d).length > 0);
        return (
          <button key={d} type="button" aria-pressed={d === day} aria-label={`${weekdayDayMonth(d)}${has ? ', є заняття' : ''}`}
            className={`${d === day ? 'is-selected' : ''} ${d === today ? 'is-today' : ''}`} onClick={() => onPick(d)}>
            <small>{WEEKDAYS[i]}</small>
            <strong>{parseDate(d).getDate()}</strong>
            <i className={has ? 'has-items' : ''} />
          </button>
        );
      })}
    </div>
  );
}

/* Заняття: деталі та дії */
function SessionSheet({ id, onClose, onChange }) {
  const { user } = useAuth();
  const { data: s, error, reload } = useData(`/sessions/${id}`);
  const [mode, setMode] = useState(null);
  const [run, busy] = useAction();
  const { toast, confirm } = useUI();
  const isStudent = user.role === 'student';
  const isManager = user.role === 'manager';
  const canManage = isManager || (user.role === 'teacher' && s?.teacher_id === user.id);

  const done = () => { setMode(null); reload(); onChange(); };

  // Прибирає всю постановку: майбутні заняття зникають, минулі лишаються в історії.
  const unschedule = async () => {
    const yes = await confirm({
      title: s.kind === 'weekly' ? `Прибрати «${s.title}» з розкладу?` : 'Прибрати заняття з розкладу?',
      text: s.kind === 'weekly' ? 'Зникнуть усі майбутні заняття цієї постановки. Минулі лишаться в історії.' : 'Заняття зникне з календаря.',
      action: 'Прибрати', danger: true,
    });
    if (!yes) return;
    if (await run(() => api(`/schedules/${s.schedule_id}`, { method: 'DELETE' }), 'Прибрано з розкладу')) {
      onChange();
      onClose();
    }
  };

  const reopen = async () => {
    const yes = await confirm({
      title: s.status === 'completed' ? 'Скасувати проведення?' : 'Відновити заняття?',
      text: s.status === 'completed' ? 'Списані уроки повернуться на абонементи.' : undefined,
      action: 'Повернути в план',
    });
    if (yes && (await run(() => api(`/sessions/${id}/reopen`, { method: 'POST' }), 'Заняття повернуто в план'))) done();
  };

  const future = s && s.starts_at > nowLocal();
  const pendingMine = s?.requests?.find((r) => r.status === 'pending');

  return (
    <Modal side title={s?.title ?? 'Заняття'} onClose={onClose}>
      {error && <ErrorNote text={error} onRetry={reload} />}
      {!s && !error && <Loader />}
      {s && (
        <div className="sheet">
          <div className="sheet-when">
            <strong>{weekdayDayMonth(s.starts_at.slice(0, 10))}</strong>
            <span>{time(s.starts_at)}–{time(s.ends_at)}</span>
            <Status kind={s.status}>{STATUS[s.status]}</Status>
          </div>
          {isMoved(s) && <p className="muted small"><IconMove size={16} /> Перенесено з {dateTimeShort(s.original_starts_at)}</p>}
          {s.status === 'cancelled' && s.cancel_reason && <p className="muted small"><IconBan size={16} /> {s.cancel_reason}</p>}

          <dl className="facts">
            <div><dt><IconUser size={18} /><span className="sr">Вчитель</span></dt><dd>{s.teacher_name ?? 'Без вчителя'}</dd></div>
            {s.course_title && <div><dt><IconLesson size={18} /><span className="sr">Курс</span></dt><dd>{s.course_title}</dd></div>}
            {(s.location || canManage) && (
              <div>
                <dt><IconPin size={18} /><span className="sr">Місце</span></dt>
                <dd><PlaceField session={s} canEdit={canManage} onSaved={() => { reload(); onChange(); }} /></dd>
              </div>
            )}
            <div><dt>{s.kind === 'weekly' ? <IconRepeat size={18} /> : <IconOnce size={18} />}<span className="sr">Тип</span></dt><dd>{s.kind === 'weekly' ? 'Постійний урок' : 'Одноразовий урок'}</dd></div>
          </dl>
          {s.note && <p className="note"><Linkify text={s.note} /></p>}

          {s.students && (
            <section>
              <div className="section-head">
                <h3><IconPeople size={18} /> Учні</h3>
                {isManager && !mode && <Button variant="ghost" small onClick={() => setMode('people')}>Змінити склад</Button>}
              </div>
              {s.students.length === 0 && <p className="muted small">Учнів ще не додано</p>}
              <ul className="roster">
                {s.students.map((st) => (
                  <li key={st.id}>
                    <span>{st.name}</span>
                    {s.status === 'completed' && (
                      st.attended
                        ? <Status kind="completed">{st.price_charged != null ? money(st.price_charged) : 'Без абонемента'}</Status>
                        : <Status kind="cancelled">Не був</Status>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {isStudent && s.status === 'completed' && s.my_attended !== null && (
            <p className="note">{s.my_attended ? `Присутність підтверджено${s.my_price != null ? `, списано ${money(s.my_price)}` : ''}` : 'Позначено як відсутність'}</p>
          )}

          {!isStudent && s.requests?.length > 0 && (
            <p className="note">Є запит учня: {s.requests.map((r) => `${r.student_name}, ${r.kind === 'cancel' ? 'скасувати' : `перенести на ${dateTimeShort(r.proposed_starts_at)}`}`).join('; ')}</p>
          )}

          {(s.homework.length > 0 || canManage) && (
            <section>
              <h3><IconHomework size={18} /> Домашнє</h3>
              <ul className="links">
                {s.homework.map((h) => (
                  <li key={h.id}><Link to={`/homework/${h.id}`} onClick={onClose}>{h.title}</Link><small>до {dateTimeShort(h.due_at)}</small></li>
                ))}
              </ul>
              {canManage && (
                <Button variant="ghost" small icon={<IconPlus size={16} />} onClick={() => setMode('homework')}>Задати домашнє</Button>
              )}
            </section>
          )}

          {canManage && !mode && (
            <div className="sheet-actions">
              {s.status === 'scheduled' && !future && <Button icon={<IconTick size={18} />} onClick={() => setMode('complete')}>Провести</Button>}
              {s.status === 'scheduled' && <Button variant="ghost" icon={<IconMove size={18} />} onClick={() => setMode('reschedule')}>Перенести</Button>}
              {s.status === 'scheduled' && <Button variant="ghost" icon={<IconBan size={18} />} onClick={() => setMode('cancel')}>Скасувати</Button>}
              {s.status !== 'scheduled' && <Button variant="ghost" busy={busy} icon={<IconRestore size={18} />} onClick={reopen}>Повернути в план</Button>}
              {isManager && <Button variant="ghost" busy={busy} icon={<IconClose size={18} />} onClick={unschedule}>Прибрати з розкладу</Button>}
            </div>
          )}
          {mode === 'people' && <PlacementForm scheduleId={s.schedule_id} onCancel={() => setMode(null)} onDone={done} />}
          {isStudent && !mode && s.status === 'scheduled' && future && (
            pendingMine
              ? <p className="note"><IconClock size={16} /> Запит надіслано. Чекає на відповідь.</p>
              : (
                <div className="sheet-actions">
                  <Button variant="ghost" icon={<IconMove size={18} />} onClick={() => setMode('ask-reschedule')}>Попросити перенести</Button>
                  <Button variant="ghost" icon={<IconBan size={18} />} onClick={() => setMode('ask-cancel')}>Попросити скасувати</Button>
                </div>
              )
          )}

          {mode === 'complete' && <CompleteForm session={s} onCancel={() => setMode(null)} onDone={(warn) => {
            if (warn?.length) toast(`Без активного абонемента: ${warn.join(', ')}`, 'error');
            done();
          }} />}
          {mode === 'reschedule' && <MoveForm session={s} onCancel={() => setMode(null)} onDone={done}
            submit={(starts_at) => api(`/sessions/${id}/reschedule`, { method: 'POST', body: { starts_at } })} success="Заняття перенесено" action="Перенести" />}
          {mode === 'cancel' && <ReasonForm onCancel={() => setMode(null)} onDone={done} action="Скасувати заняття" success="Заняття скасовано"
            submit={(reason) => api(`/sessions/${id}/cancel`, { method: 'POST', body: { reason } })} />}
          {mode === 'ask-reschedule' && <MoveForm session={s} withReason onCancel={() => setMode(null)} onDone={done} action="Надіслати запит" success="Запит надіслано"
            submit={(proposed_starts_at, reason) => api(`/sessions/${id}/requests`, { method: 'POST', body: { kind: 'reschedule', proposed_starts_at, reason } })} />}
          {mode === 'ask-cancel' && <ReasonForm onCancel={() => setMode(null)} onDone={done} action="Надіслати запит" success="Запит надіслано"
            submit={(reason) => api(`/sessions/${id}/requests`, { method: 'POST', body: { kind: 'cancel', reason } })} />}
          {mode === 'homework' && <HomeworkForm session={s} onCancel={() => setMode(null)} onDone={done} />}
        </div>
      )}
    </Modal>
  );
}

function FormActions({ onCancel, action, busy }) {
  return (
    <div className="form-actions">
      <Button variant="ghost" onClick={onCancel}>Назад</Button>
      <Button type="submit" busy={busy}>{action}</Button>
    </div>
  );
}

function CompleteForm({ session, onCancel, onDone }) {
  const [present, setPresent] = useState(session.students.map((s) => s.id));
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const r = await run(() => api(`/sessions/${session.id}/complete`, { method: 'POST', body: { attended_ids: present } }), 'Заняття проведено');
    if (r) onDone(r.no_subscription);
  };
  return (
    <form className="sheet-form" onSubmit={submit}>
      <h3>Хто був на занятті</h3>
      <div className="check-list">
        {session.students.map((s) => (
          <Checkbox key={s.id} checked={present.includes(s.id)}
            onChange={(on) => setPresent(on ? [...present, s.id] : present.filter((x) => x !== s.id))}>{s.name}</Checkbox>
        ))}
      </div>
      <p className="muted small">Присутнім спишеться один урок з абонемента.</p>
      <FormActions onCancel={onCancel} action="Підтвердити" busy={busy} />
    </form>
  );
}

function MoveForm({ session, onCancel, onDone, submit, success, action, withReason }) {
  const today = todayISO();
  const [date, setDate] = useState(session.starts_at.slice(0, 10) < today ? today : session.starts_at.slice(0, 10));
  const [t, setT] = useState(time(session.starts_at));
  const [reason, setReason] = useState('');
  const [run, busy] = useAction();
  const go = async (e) => {
    e.preventDefault();
    if (await run(() => submit(`${date} ${t}:00`, reason), success)) onDone();
  };
  return (
    <form className="sheet-form" onSubmit={go}>
      <h3>{withReason ? 'Бажаний час' : 'Новий час'}</h3>
      <div className="form-row">
        <DatePicker label="Дата" value={date} onChange={setDate} min={today} />
        <TimePicker label="Час" value={t} onChange={setT} />
      </div>
      {withReason && <Input label="Причина" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />}
      <FormActions onCancel={onCancel} action={action} busy={busy} />
    </form>
  );
}

function ReasonForm({ onCancel, onDone, submit, action, success }) {
  const [reason, setReason] = useState('');
  const [run, busy] = useAction();
  const go = async (e) => {
    e.preventDefault();
    if (await run(() => submit(reason), success)) onDone();
  };
  return (
    <form className="sheet-form" onSubmit={go}>
      <Input label="Причина" autoFocus value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
      <FormActions onCancel={onCancel} action={action} busy={busy} />
    </form>
  );
}

function HomeworkForm({ session, onCancel, onDone }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const base = session.starts_at.slice(0, 10) < todayISO() ? todayISO() : session.starts_at.slice(0, 10);
  const [date, setDate] = useState(addDays(base, 7));
  const [t, setT] = useState('23:55');
  const [run, busy] = useAction();
  const go = async (e) => {
    e.preventDefault();
    const ok = await run(() => api('/homework', { method: 'POST', body: {
      lesson_id: session.lesson_id, session_id: session.id, title, description, due_at: `${date} ${t}:00`,
    } }), 'Домашнє задано');
    if (ok) onDone();
  };
  return (
    <form className="sheet-form" onSubmit={go}>
      <h3>Нове домашнє</h3>
      <Input label="Назва" autoFocus required value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label="Завдання" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="form-row">
        <DatePicker label="Здати до" value={date} onChange={setDate} />
        <TimePicker label="Час" value={t} onChange={setT} />
      </div>
      <FormActions onCancel={onCancel} action="Задати" busy={busy} />
    </form>
  );
}

/**
 * Місце чи посилання прямо в картці заняття. Зміна діє лише на це заняття: інші й сам урок не змінюються.
 * Enter зберігає, Esc скасовує, порожнє поле повертає місце з уроку.
 */
function PlaceField({ session, canEdit, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [run, busy] = useAction();
  const open = () => { setValue(session.location ?? ''); setEditing(true); };
  const save = async (e) => {
    e.preventDefault();
    const ok = await run(() => api(`/sessions/${session.id}/location`, { method: 'PATCH', body: { location: value } }), 'Місце збережено');
    if (ok) { setEditing(false); onSaved(); }
  };
  if (editing) {
    return (
      <form className="place-edit" onSubmit={save}>
        <input className="input" autoFocus aria-label="Місце або посилання" placeholder="Кабінет або посилання" maxLength={200}
          value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); } }} />
        <div className="place-edit-actions">
          <Button variant="ghost" small onClick={() => setEditing(false)}>Скасувати</Button>
          <Button type="submit" small busy={busy}>Зберегти</Button>
        </div>
        <small className="muted">Лише для цього заняття. Порожньо: місце з уроку.</small>
      </form>
    );
  }
  return (
    <span className="place-view">
      {session.location ? <span><Linkify text={session.location} />{session.own_location && <small className="muted"> · лише це заняття</small>}</span> : <span className="muted">Місце не вказано</span>}
      {canEdit && <IconButton label="Змінити місце" onClick={open}><IconEdit size={16} /></IconButton>}
    </span>
  );
}

/** Вибір вчителя й учнів постановки. Вимкнених, які вже в ній, теж показуємо: інакше їх не прибрати. */
function usePeopleOptions(current = { teacherId: null, studentIds: [] }) {
  const people = useData('/users');
  const list = people.data ?? [];
  const label = (u) => (u.is_active ? u.name : `${u.name} (вимкнений)`);
  return {
    teachers: list.filter((u) => u.role === 'teacher' && (u.is_active || u.id === current.teacherId)).map((u) => ({ value: u.id, label: label(u) })),
    pupils: list.filter((u) => u.role === 'student' && (u.is_active || current.studentIds.includes(u.id))).map((u) => ({ value: u.id, label: label(u) })),
  };
}

function PeopleFields({ teacherId, setTeacherId, students, setStudents, options }) {
  return (
    <>
      <Select label="Вчитель" value={teacherId} onChange={setTeacherId} clearable="Без вчителя" placeholder="Без вчителя" options={options.teachers} />
      <Select label="Учні" multiple value={students} onChange={setStudents} options={options.pupils} placeholder="Оберіть учнів" />
    </>
  );
}

/* Склад постановки з картки заняття: діє на всі майбутні заняття цієї постановки */
function PlacementForm({ scheduleId, onCancel, onDone }) {
  const { data: placement } = useData(`/schedules/${scheduleId}`);
  const [teacherId, setTeacherId] = useState(undefined);
  const [students, setStudents] = useState(undefined);
  const [run, busy] = useAction();
  const options = usePeopleOptions({ teacherId: placement?.teacher_id ?? null, studentIds: placement?.students.map((s) => s.id) ?? [] });
  if (!placement) return <Loader />;
  const tId = teacherId === undefined ? placement.teacher_id : teacherId;
  const sIds = students === undefined ? placement.students.map((s) => s.id) : students;
  const go = async (e) => {
    e.preventDefault();
    if (await run(() => api(`/schedules/${scheduleId}`, { method: 'PATCH', body: { teacher_id: tId, student_ids: sIds } }), 'Склад збережено')) onDone();
  };
  return (
    <form className="sheet-form" onSubmit={go}>
      <h3>Склад</h3>
      <PeopleFields teacherId={tId} setTeacherId={setTeacherId} students={sIds} setStudents={setStudents} options={options} />
      {placement.kind === 'weekly' && <p className="muted small">Зміна діє на всі майбутні заняття. Минулі й списання не зміняться.</p>}
      <FormActions onCancel={onCancel} action="Зберегти" busy={busy} />
    </form>
  );
}

/* Постановка уроку в розклад: урок, вчитель, учні, постійно або одноразово */
export function ScheduleForm({ preset = {}, onClose, onDone }) {
  const today = todayISO();
  const { data: lessons, loading } = useData('/lessons');
  const options = usePeopleOptions();
  const [teacherId, setTeacherId] = useState(null);
  const [students, setStudents] = useState([]);
  const [lessonId, setLessonId] = useState(preset.lessonId ?? null);
  const [kind, setKind] = useState(preset.date ? 'once' : 'weekly');
  const [weekdays, setWeekdays] = useState(preset.date ? [weekdayOf(preset.date)] : []);
  const [date, setDate] = useState(preset.date ?? today);
  const [startDate, setStartDate] = useState(preset.date ?? today);
  const [endDate, setEndDate] = useState('');
  const [t, setT] = useState(preset.time ?? '17:00');
  const [run, busy] = useAction();

  const active = (lessons ?? []).filter((l) => l.is_active);

  const submit = async (e) => {
    e.preventDefault();
    const people = { teacher_id: teacherId, student_ids: students };
    const body = kind === 'once'
      ? { lesson_id: lessonId, kind, date, time: t, ...people }
      : { lesson_id: lessonId, kind, weekdays, time: t, start_date: startDate, end_date: endDate || null, ...people };
    if (await run(() => api('/schedules', { method: 'POST', body }), 'Додано в розклад')) onDone();
  };
  const incomplete = !lessonId || !t || (kind === 'weekly' && !weekdays.length);

  return (
    <Modal title="Додати в розклад" onClose={onClose}>
      {!loading && !active.length ? (
        <Empty icon={<IconList size={36} />} title="Спершу створіть урок" action={<Link className="btn btn-primary" to="/lessons" onClick={onClose}>До уроків</Link>} />
      ) : (
        <form className="form" onSubmit={submit}>
          <Select label="Урок" value={lessonId} onChange={setLessonId} placeholder="Оберіть урок"
            options={active.map((l) => ({ value: l.id, label: l.title, hint: [l.course_title, `${l.duration_min} хв`].filter(Boolean).join(', ') }))} />
          <PeopleFields teacherId={teacherId} setTeacherId={setTeacherId} students={students} setStudents={setStudents} options={options} />
          <Segmented label="Як часто" value={kind} onChange={setKind} options={[
            { value: 'weekly', label: 'Постійно', icon: <IconRepeat size={18} /> },
            { value: 'once', label: 'Одноразово', icon: <IconOnce size={18} /> },
          ]} />
          {kind === 'weekly' ? (
            <>
              <WeekdayPicker label="Дні тижня" value={weekdays} onChange={setWeekdays} />
              <div className="form-row">
                <TimePicker label="Час" value={t} onChange={setT} />
                <DatePicker label="Починаючи з" value={startDate} onChange={setStartDate} />
              </div>
              <DatePicker label="До якої дати" hint="Порожньо: без кінцевої дати" placeholder="Без кінця" clearable value={endDate} onChange={setEndDate} min={startDate} />
            </>
          ) : (
            <div className="form-row">
              <DatePicker label="Дата" value={date} onChange={setDate} />
              <TimePicker label="Час" value={t} onChange={setT} />
            </div>
          )}
          <div className="form-actions">
            <Button variant="ghost" onClick={onClose}>Назад</Button>
            <Button type="submit" busy={busy} disabled={incomplete}>Додати</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
