import { useState } from 'react';
import { useData } from '../api.js';
import { ErrorNote, Loader, PageHead, Segmented } from '../ui.jsx';
import { MONTHS, addDays, money, todayISO } from '../fmt.js';

/* Невелика аналітика для менеджера: гроші з абонементів і заняття. */

const PERIODS = [
  { value: 'month', label: 'Цей місяць' },
  { value: 'prev', label: 'Минулий' },
  { value: '90', label: '90 днів' },
  { value: 'year', label: 'Рік' },
];

function rangeOf(period) {
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  if (period === 'month') return { from: monthStart, to: today };
  if (period === 'prev') {
    const prevEnd = addDays(monthStart, -1);
    return { from: `${prevEnd.slice(0, 7)}-01`, to: prevEnd };
  }
  if (period === '90') return { from: addDays(today, -89), to: today };
  return { from: addDays(today, -364), to: today };
}

const monthName = (ym, short) => {
  const name = MONTHS[Number(ym.slice(5, 7)) - 1];
  return short ? name.slice(0, 3) : `${name[0].toUpperCase()}${name.slice(1)} ${ym.slice(0, 4)}`;
};
const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

function Tile({ label, value, note, alert }) {
  return (
    <div className={`stat-tile ${alert ? 'is-alert' : ''}`}>
      <small>{label}</small>
      <strong>{value}</strong>
      {note && <span>{note}</span>}
    </div>
  );
}

/* Один ряд даних: дохід від проданих абонементів за місяць. Значення є в підказці й у таблиці нижче. */
function MonthlyBars({ months }) {
  const max = Math.max(...months.map((m) => m.sold), 1);
  const last = months.length - 1;
  return (
    <figure className="bars" aria-label="Продано абонементів за місяцями">
      <div className="bars-plot">
        {months.map((m, i) => (
          <div key={m.month} className="bar-col">
            <button type="button" className="bar-hit" aria-label={`${monthName(m.month)}: ${money(m.sold)}`}>
              <span className="bar-tip" role="tooltip"><b>{monthName(m.month)}</b>{money(m.sold)}</span>
              <i className="bar" style={{ height: `${(m.sold / max) * 100}%` }}>
                {i === last && <span className="bar-label">{money(m.sold)}</span>}
              </i>
            </button>
            <small>{monthName(m.month, true)}</small>
          </div>
        ))}
      </div>
    </figure>
  );
}

export default function Stats() {
  const [period, setPeriod] = useState('month');
  const { from, to } = rangeOf(period);
  const { data: s, error, reload } = useData(`/stats?from=${from}&to=${to}`);

  return (
    <>
      <PageHead title="Статистика" />
      <div className="stats-bar">
        <Segmented value={period} onChange={setPeriod} options={PERIODS} />
      </div>
      {error && <ErrorNote text={error} onRetry={reload} />}
      {!s && !error && <Loader />}
      {s && (
        <>
          <section className="stat-tiles" aria-label="Підсумки за період">
            <Tile label="Продано абонементів" value={money(s.sold.amount)} note={`${s.sold.count} шт.`} />
            <Tile label="Відпрацьовано" value={money(s.earned.amount)} note={`${s.earned.lessons} списаних уроків`} />
            <Tile label="Проведено занять" value={s.sessions.completed} note={s.sessions.unmarked ? `ще не позначено: ${s.sessions.unmarked}` : `заплановано: ${s.sessions.upcoming}`} alert={s.sessions.unmarked > 0} />
            <Tile label="Скасовано" value={s.sessions.cancelled} note={`${pct(s.sessions.cancelled, s.sessions.completed + s.sessions.cancelled)} від закритих`} />
            <Tile label="Відвідуваність" value={pct(s.attendance.present, s.attendance.marked)} note={`${s.attendance.present} із ${s.attendance.marked} відміток`} />
            <Tile label="Передплачено зараз" value={money(s.prepaid.amount)} note={`${s.prepaid.lessons} уроків на ${s.prepaid.subscriptions} абонементах`} />
          </section>

          <section className="stats-section">
            <h2>Продано абонементів за місяцями</h2>
            <MonthlyBars months={s.monthly} />
            <div className="table-wrap">
              <table className="stats-table">
                <thead>
                  <tr><th>Місяць</th><th>Продано</th><th>Відпрацьовано</th><th>Проведено</th><th>Скасовано</th></tr>
                </thead>
                <tbody>
                  {[...s.monthly].reverse().map((m) => (
                    <tr key={m.month}>
                      <th scope="row">{monthName(m.month)}</th>
                      <td>{money(m.sold)}</td><td>{money(m.earned)}</td><td>{m.completed}</td><td>{m.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="stats-section">
            <h2>Вчителі за період</h2>
            {s.teachers.length === 0 ? <p className="muted small">За цей період занять ще не закрито.</p> : (
              <div className="table-wrap">
                <table className="stats-table">
                  <thead><tr><th>Вчитель</th><th>Проведено</th><th>Скасовано</th><th>Відпрацьовано</th></tr></thead>
                  <tbody>
                    {s.teachers.map((t) => (
                      <tr key={t.name}><th scope="row">{t.name}</th><td>{t.completed}</td><td>{t.cancelled}</td><td>{money(t.earned)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="muted small stats-note">
            «Продано»: вартість абонементів, виданих за період, за ціною в момент видачі. «Відпрацьовано»: списане за проведені заняття та вручну. «Передплачено»: уроки, за які вже заплатили, але ще не провели.
          </p>
        </>
      )}
    </>
  );
}
