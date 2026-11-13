import { useState } from 'react';
import { api, useData } from '../api.js';
import { Button, DatePicker, Empty, ErrorNote, IconButton, Input, Loader, Modal, PageTools, Segmented, Select, Stepper, useAction, useUI } from '../ui.jsx';
import { Avatar, Who } from '../avatars.jsx';
import { IconAlert, IconClock, IconClose, IconEdit, IconHourglass, IconList, IconMinus, IconPlus, IconTick, IconTicket } from '../icons.jsx';
import { addDays, dateTimeShort, lessonsWord, money, shortDate, todayISO } from '../fmt.js';

/** Кольори квитка. Має збігатися з PLAN_COLORS у server/modules/plans/plans.service.ts. */
export const PLAN_COLORS = [
  ['red', 'Червоний'], ['orange', 'Помаранчевий'], ['amber', 'Бурштиновий'], ['green', 'Зелений'], ['teal', 'Бірюзовий'],
  ['blue', 'Синій'], ['violet', 'Фіолетовий'], ['pink', 'Рожевий'], ['ink', 'Графітовий'],
];
export const ticketClass = (color) => `tk-${PLAN_COLORS.some(([c]) => c === color) ? color : 'red'}`;

/** Вибір кольору квитка: кружечки-зразки. */
function ColorPicker({ value, onChange }) {
  return (
    <fieldset className="tk-colors">
      <legend>Колір квитка</legend>
      <div role="radiogroup" aria-label="Колір квитка">
        {PLAN_COLORS.map(([c, label]) => (
          <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={label} title={label}
            className={`tk-color ${ticketClass(c)} ${value === c ? 'is-on' : ''}`} onClick={() => onChange(c)}>
            {value === c && <IconTick size={16} />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export const subState = (s) => {
  if (s.status === 'closed') return ['cancelled', 'Закрито'];
  if (s.is_expired) return ['cancelled', 'Термін минув'];
  if (s.lessons_left <= 0) return ['cancelled', 'Уроки закінчились'];
  return s.lessons_left <= 1 ? ['warn', 'Закінчується'] : ['completed', 'Діє'];
};

/** Колір залишку: 1–2 заняття (або нуль) — червоний, до половини — помаранчевий, більше половини — зелений. */
export const leftLevel = (s) => {
  if (s.lessons_left <= 2) return 'is-low';
  return s.lessons_left > s.lessons_total / 2 ? 'is-ok' : 'is-mid';
};

/** Стан абонемента круглою іконкою на початку рядка: колір і знак замість текстової плашки. */
const SUB_ICON = {
  active: ['is-ok', IconTick],
  ending: ['is-mid', IconHourglass],
  empty: ['is-low', IconAlert],
  expired: ['is-off', IconClock],
  closed: ['is-off', IconClose],
};
const subCode = (s) => {
  if (s.status === 'closed') return 'closed';
  if (s.is_expired) return 'expired';
  if (s.lessons_left <= 0) return 'empty';
  return s.lessons_left <= 1 ? 'ending' : 'active';
};
function SubStateIcon({ s }) {
  const [cls, Icon] = SUB_ICON[subCode(s)];
  const text = subState(s)[1];
  return <span className={`sub-state ${cls}`} role="img" aria-label={text} title={text}><Icon size={18} /></span>;
}

export default function Subscriptions() {
  const [tab, setTab] = useState('issued');
  const subs = useData('/subscriptions');
  const plans = useData('/plans');
  const [issuing, setIssuing] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [history, setHistory] = useState(null);
  const [writingOff, setWritingOff] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);

  return (
    <>
      <PageTools title="Абонементи" filtered={tab !== 'issued'} filters={
        <Segmented value={tab} onChange={setTab} options={[{ value: 'issued', label: 'Видані' }, { value: 'plans', label: 'Види' }]} />
      }>
        {tab === 'issued'
          ? <Button icon={<IconPlus size={18} />} onClick={() => setIssuing(true)}>Видати абонемент</Button>
          : <Button icon={<IconPlus size={18} />} onClick={() => setEditingPlan({})}>Новий абонемент</Button>}
      </PageTools>

      {tab === 'issued' && (
        <>
          {subs.error && <ErrorNote text={subs.error} onRetry={subs.reload} />}
          {!subs.data && subs.loading && <Loader />}
          {subs.data && !subs.data.length && <Empty icon={<IconTicket size={36} />} title="Ще нікому не видано" />}
          {subs.data?.length > 0 && (
            <ul className="rows">
              {subs.data.map((s) => {
                return (
                  <li key={s.id} className={`row sub-row ${ticketClass(s.color)}`}>
                    <i className="tk-bar" aria-hidden="true" />
                    <SubStateIcon s={s} />
                    <div className="row-main">
                      <h3><Who name={s.student_name} avatar={s.student_avatar} size={26} /></h3>
                      <p className="muted small">{s.name}, до {shortDate(s.expires_on)}</p>
                    </div>
                    <div className={`sub-left ${leftLevel(s)}`} title={`Залишилось занять: ${s.lessons_left} із ${s.lessons_total}`}>
                      <strong>{s.lessons_left}</strong><small>із {s.lessons_total}</small>
                    </div>
                    <div className="row-actions">
                      <IconButton label="Списати" disabled={s.lessons_left <= 0} onClick={() => setWritingOff(s)}><IconMinus size={18} /></IconButton>
                      <IconButton label="Списання" onClick={() => setHistory(s)}><IconList size={18} /></IconButton>
                      <IconButton label="Змінити" onClick={() => setEditingSub(s)}><IconEdit size={18} /></IconButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === 'plans' && (
        <>
          {plans.error && <ErrorNote text={plans.error} onRetry={plans.reload} />}
          {!plans.data && plans.loading && <Loader />}
          {plans.data && !plans.data.length && <Empty icon={<IconTicket size={36} />} title="Створіть перший абонемент" />}
          <ul className="plans">
            {(plans.data ?? []).map((p) => (
              <li key={p.id} className={`ticket ${ticketClass(p.color)} ${p.is_active ? '' : 'is-off'}`}>
                <div className="ticket-main">
                  <h3>{p.name}</h3>
                  <p className="ticket-count">{lessonsWord(p.lessons_count)}, {p.valid_days} днів</p>
                </div>
                <div className="ticket-stub">
                  <strong>{money(p.price_per_lesson)}</strong>
                  <small>за заняття</small>
                  <small>разом {money(p.price_per_lesson * p.lessons_count)}</small>
                  <Button variant="onred" small onClick={() => setEditingPlan(p)}>Змінити</Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {issuing && <IssueForm onClose={() => setIssuing(false)} onDone={() => { setIssuing(false); subs.reload(); plans.reload(); }} />}
      {editingSub && <SubForm sub={editingSub} onClose={() => setEditingSub(null)} onDone={() => { setEditingSub(null); subs.reload(); }} />}
      {history && <ChargesModal sub={history} canUndo onChange={subs.reload} onClose={() => setHistory(null)} />}
      {writingOff && <WriteoffForm sub={writingOff} onClose={() => setWritingOff(null)} onDone={() => { setWritingOff(null); subs.reload(); }} />}
      {editingPlan && <PlanForm plan={editingPlan} onClose={() => setEditingPlan(null)} onDone={() => { setEditingPlan(null); plans.reload(); }} />}
    </>
  );
}

/** Показує різницю між вартістю для учня та базовою вартістю абонемента. */
function priceDelta(price, base) {
  const d = Math.round((Number(price) - base) * 100) / 100;
  if (!d) return 'Базова вартість';
  return `${d > 0 ? '+' : '−'}${money(Math.abs(d))} до базової`;
}

function IssueForm({ onClose, onDone }) {
  const people = useData('/users?role=student');
  const plans = useData('/plans');
  const [studentId, setStudentId] = useState(null);
  const [planId, setPlanId] = useState(null);
  const [price, setPrice] = useState('');
  const [count, setCount] = useState('');
  const [startsOn, setStartsOn] = useState(todayISO());
  const [expiresOn, setExpiresOn] = useState('');
  const [run, busy] = useAction();

  const active = (plans.data ?? []).filter((p) => p.is_active);
  const plan = active.find((p) => p.id === planId);

  const pickPlan = (id) => {
    const p = active.find((x) => x.id === id);
    setPlanId(id);
    setPrice(p.price_per_lesson);
    setCount(p.lessons_count);
    setExpiresOn(addDays(startsOn, p.valid_days));
  };
  const changeStart = (d) => {
    setStartsOn(d);
    if (plan) setExpiresOn(addDays(d, plan.valid_days));
  };
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(() => api('/subscriptions', { method: 'POST', body: {
      student_id: studentId, plan_id: planId, price_per_lesson: Number(price), lessons_total: Number(count), starts_on: startsOn, expires_on: expiresOn,
    } }), 'Абонемент видано');
    if (ok) onDone();
  };

  return (
    <Modal title="Видати абонемент" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <Select label="Учень" value={studentId} onChange={setStudentId} options={(people.data ?? []).filter((u) => u.is_active).map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size={22} /> }))} />
          <Select label="Абонемент" value={planId} onChange={pickPlan} options={active.map((p) => ({ value: p.id, label: p.name, icon: <i className={`tk-dot ${ticketClass(p.color)}`} />, hint: `${lessonsWord(p.lessons_count)}, ${money(p.price_per_lesson)}` }))} />
        </div>
        {plan && (
          <>
            <div className="form-row">
              <Stepper label="Вартість заняття" suffix="₴" step={10} value={price} onChange={setPrice} hint={priceDelta(price, plan.price_per_lesson)} />
              <Stepper label="Уроків" value={count} onChange={setCount} min={1} max={500} />
            </div>
            <div className="form-row">
              <DatePicker label="Початок" value={startsOn} onChange={changeStart} />
              <DatePicker label="Закінчення" value={expiresOn} onChange={setExpiresOn} min={startsOn} />
            </div>
            <p className="total">Разом <strong>{money(Number(price) * Number(count))}</strong></p>
          </>
        )}
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy} disabled={!studentId || !planId}>Видати</Button>
        </div>
      </form>
    </Modal>
  );
}

function SubForm({ sub, onClose, onDone }) {
  const [price, setPrice] = useState(sub.price_per_lesson);
  const [count, setCount] = useState(sub.lessons_total);
  const [expiresOn, setExpiresOn] = useState(sub.expires_on);
  const [status, setStatus] = useState(sub.status);
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(() => api(`/subscriptions/${sub.id}`, { method: 'PATCH', body: {
      price_per_lesson: Number(price), lessons_total: Number(count), expires_on: expiresOn, status,
    } }), 'Зміни збережено');
    if (ok) onDone();
  };
  return (
    <Modal title={`${sub.student_name}: ${sub.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <Stepper label="Вартість заняття" suffix="₴" step={10} value={price} onChange={setPrice} hint="Діє на наступні заняття" />
          <Stepper label="Уроків" value={count} onChange={setCount} min={Math.max(1, sub.lessons_used)} max={500} hint={`Використано ${sub.lessons_used}`} />
        </div>
        <DatePicker label="Закінчення" value={expiresOn} onChange={setExpiresOn} min={sub.starts_on} />
        <Segmented label="Стан" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Активний' }, { value: 'closed', label: 'Закритий' }]} />
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy}>Зберегти</Button>
        </div>
      </form>
    </Modal>
  );
}

/* Ручне списання: учень займався, але заняття немає в розкладі */
function WriteoffForm({ sub, onClose, onDone }) {
  const [lessons, setLessons] = useState(1);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(() => api(`/subscriptions/${sub.id}/writeoffs`, { method: 'POST', body: { lessons: Number(lessons), date, note } }), 'Уроки списано');
    if (ok) onDone();
  };
  return (
    <Modal narrow title={`Списати: ${sub.student_name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted small">{sub.name}: лишилось {lessonsWord(sub.lessons_left)}, {money(sub.price_per_lesson)} за заняття.</p>
        <div className="form-row">
          <Stepper label="Уроків" value={lessons} onChange={setLessons} min={1} max={sub.lessons_left} />
          <DatePicker label="Дата" value={date} onChange={setDate} />
        </div>
        <Input label="Коментар" placeholder="Наприклад, заняття поза розкладом" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="total">Спишеться <strong>{money(Number(lessons) * sub.price_per_lesson)}</strong></p>
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy} disabled={!(Number(lessons) >= 1)}>Списати</Button>
        </div>
      </form>
    </Modal>
  );
}

export function ChargesModal({ sub, onClose, canUndo, onChange }) {
  const { data, error, reload } = useData(`/subscriptions/${sub.id}/charges`);
  const [run] = useAction();
  const { confirm } = useUI();
  const undo = async (c) => {
    const yes = await confirm({ title: 'Скасувати списання?', text: `${lessonsWord(c.lessons)} повернуться на абонемент.`, action: 'Скасувати списання', danger: true });
    if (yes && (await run(() => api(`/subscriptions/${sub.id}/writeoffs/${c.writeoff_id}`, { method: 'DELETE' }), 'Уроки повернуто'))) {
      reload();
      onChange?.();
    }
  };
  return (
    <Modal side title={`Списання: ${sub.name}`} onClose={onClose}>
      {error && <ErrorNote text={error} onRetry={reload} />}
      {!data && !error && <Loader />}
      {data && !data.length && <Empty icon={<IconList size={36} />} title="Списань ще немає" />}
      {data?.length > 0 && (
        <>
          <ul className="charges">
            {data.map((c) => (
              <li key={c.key}>
                <span>
                  <strong>{c.title}</strong>
                  <small>{c.kind === 'manual' ? `${shortDate(c.date)}, вручну, ${lessonsWord(c.lessons)}` : dateTimeShort(c.starts_at)}</small>
                </span>
                <span className="charge-amount">
                  {money(c.price_charged)}
                  {canUndo && c.kind === 'manual' && <IconButton label="Скасувати списання" onClick={() => undo(c)}><IconClose size={16} /></IconButton>}
                </span>
              </li>
            ))}
          </ul>
          <p className="total">Разом <strong>{money(data.reduce((a, c) => a + Number(c.price_charged ?? 0), 0))}</strong></p>
        </>
      )}
    </Modal>
  );
}

function PlanForm({ plan, onClose, onDone }) {
  const isNew = !plan.id;
  const [name, setName] = useState(plan.name ?? '');
  const [count, setCount] = useState(plan.lessons_count ?? 8);
  const [price, setPrice] = useState(plan.price_per_lesson ?? 400);
  const [days, setDays] = useState(plan.valid_days ?? 30);
  const [active, setActive] = useState(plan.is_active ?? 1);
  const [color, setColor] = useState(plan.color ?? 'red');
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const body = { name, lessons_count: Number(count), price_per_lesson: Number(price), valid_days: Number(days), is_active: Boolean(active), color };
    const ok = await run(() => api(isNew ? '/plans' : `/plans/${plan.id}`, { method: isNew ? 'POST' : 'PATCH', body }), isNew ? 'Абонемент створено' : 'Зміни збережено');
    if (ok) onDone();
  };
  return (
    <Modal title={isNew ? 'Новий абонемент' : 'Редагувати абонемент'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Input label="Назва" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="form-row">
          <Stepper label="Уроків" value={count} onChange={setCount} min={1} max={500} />
          <Stepper label="Вартість заняття" suffix="₴" step={10} value={price} onChange={setPrice} hint={`Разом ${money(Number(price) * Number(count))}`} />
        </div>
        <Stepper label="Термін дії" suffix="днів" value={days} onChange={setDays} min={1} max={1095} step={5} />
        <ColorPicker value={color} onChange={setColor} />
        <div className={`ticket tk-preview ${ticketClass(color)}`} aria-hidden="true">
          <div className="ticket-main"><h3>{name || 'Назва абонемента'}</h3><p className="ticket-count">{lessonsWord(Number(count) || 0)}</p></div>
          <div className="ticket-stub"><strong>{money(Number(price) || 0)}</strong><small>за заняття</small></div>
        </div>
        {!isNew && (
          <>
            <Segmented label="Доступність" value={active ? 1 : 0} onChange={setActive} options={[{ value: 1, label: 'Можна видавати' }, { value: 0, label: 'Приховано' }]} />
          </>
        )}
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy}>{isNew ? 'Створити' : 'Зберегти'}</Button>
        </div>
      </form>
    </Modal>
  );
}
