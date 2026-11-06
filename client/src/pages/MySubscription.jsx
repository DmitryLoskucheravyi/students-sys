import { useState } from 'react';
import { useData } from '../api.js';
import { Button, Empty, ErrorNote, Loader, PageHead, Status } from '../ui.jsx';
import { IconTicket } from '../icons.jsx';
import { money, shortDate } from '../fmt.js';
import { ChargesModal, subState } from './Subscriptions.jsx';

export default function MySubscription() {
  const { data, loading, error, reload } = useData('/subscriptions');
  const [history, setHistory] = useState(null);
  return (
    <>
      <PageHead title="Абонемент" />
      {error && <ErrorNote text={error} onRetry={reload} />}
      {!data && loading && <Loader />}
      {data && !data.length && <Empty icon={<IconTicket size={36} />} title="Абонемента ще немає. Зверніться до менеджера." />}
      <ul className="plans">
        {(data ?? []).map((s) => {
          const [kind, text] = subState(s);
          return (
            <li key={s.id} className={`ticket ${kind === 'cancelled' ? 'is-off' : ''}`}>
              <div className="ticket-main">
                <h3>{s.name}</h3>
                <p className="ticket-big">{s.lessons_left}<small> із {s.lessons_total}</small></p>
                <p className="small">Лишилось уроків</p>
                <Status kind={kind}>{text}</Status>
              </div>
              <div className="ticket-stub">
                <strong>{money(s.price_per_lesson)}</strong>
                <small>за заняття</small>
                <small>до {shortDate(s.expires_on)}</small>
                <Button variant="onred" small onClick={() => setHistory(s)}>Списання</Button>
              </div>
            </li>
          );
        })}
      </ul>
      {history && <ChargesModal sub={history} onClose={() => setHistory(null)} />}
    </>
  );
}
