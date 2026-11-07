import { useState } from 'react';
import { api, useData } from '../api.js';
import { Button, Empty, ErrorNote, IconButton, Input, Loader, Modal, PageHead, PasswordInput, Segmented, Select, useAction, useUI } from '../ui.jsx';
import { IconBan, IconEdit, IconKey, IconPeople, IconPlus, IconRestore, IconTrash } from '../icons.jsx';
import { lessonsWord, randomPassword } from '../fmt.js';
import { Avatar, AvatarPicker } from '../avatars.jsx';

export default function People() {
  const [role, setRole] = useState('student');
  const { data, loading, error, reload } = useData('/users');
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [created, setCreated] = useState(null);
  const [run] = useAction();
  const { confirm } = useUI();

  const list = (data ?? []).filter((u) => u.role === role);
  const isStudent = role === 'student';

  const toggleActive = async (u) => {
    if (u.is_active) {
      const yes = await confirm({ title: `Вимкнути акаунт «${u.name}»?`, text: 'Людина більше не зможе увійти. Дані збережуться.', action: 'Вимкнути', danger: true });
      if (!yes) return;
    }
    const ok = await run(() => api(`/users/${u.id}`, { method: 'PATCH', body: { is_active: !u.is_active } }), u.is_active ? 'Акаунт вимкнено' : 'Акаунт увімкнено');
    if (ok) reload();
  };

  return (
    <>
      <PageHead title="Люди">
        <Button icon={<IconPlus size={18} />} onClick={() => setEditing({ role })}>{isStudent ? 'Новий учень' : 'Новий вчитель'}</Button>
      </PageHead>
      <div className="tabs">
        <Segmented value={role} onChange={setRole} options={[
          { value: 'student', label: 'Учні', count: (data ?? []).filter((u) => u.role === 'student' && u.is_active).length },
          { value: 'teacher', label: 'Вчителі', count: (data ?? []).filter((u) => u.role === 'teacher' && u.is_active).length },
        ]} />
      </div>
      {error && <ErrorNote text={error} onRetry={reload} />}
      {!data && loading && <Loader />}
      {data && !list.length && <Empty icon={<IconPeople size={36} />} title={isStudent ? 'Додайте першого учня' : 'Додайте першого вчителя'} />}
      {list.length > 0 && (
        <ul className="rows">
          {list.map((u) => (
            <li key={u.id} className={`row person-row ${u.is_active ? '' : 'is-off'}`}>
              <Avatar user={u} className="avatar-red" />
              <div className="row-main">
                <h3>{u.name}</h3>
                <p className="muted small">{u.login}{u.phone ? `, ${u.phone}` : ''}{u.is_active ? '' : ', вимкнено'}</p>
                {u.rooms?.length > 0 && <p className="small">Кабінети: {u.rooms.map((r) => r.service).join(', ')}</p>}
              </div>
              <span className="small muted person-stat">
                {isStudent ? `Лишилось: ${lessonsWord(Number(u.lessons_left))}` : `Веде: ${lessonsWord(u.lessons_as_teacher)}`}
              </span>
              <div className="row-actions">
                <IconButton label="Редагувати" onClick={() => setEditing(u)}><IconEdit size={20} /></IconButton>
                <IconButton label="Новий пароль" onClick={() => setResetting(u)}><IconKey size={20} /></IconButton>
                <IconButton label={u.is_active ? 'Вимкнути акаунт' : 'Увімкнути акаунт'} onClick={() => toggleActive(u)}>
                  {u.is_active ? <IconBan size={20} /> : <IconRestore size={20} />}
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <PersonForm person={editing} onClose={() => setEditing(null)} onDone={(c) => { setEditing(null); reload(); if (c) setCreated(c); }} />}
      {resetting && <ResetForm person={resetting} onClose={() => setResetting(null)} onDone={(c) => { setResetting(null); setCreated(c); }} />}
      {created && <CredentialsNote data={created} onClose={() => setCreated(null)} />}
    </>
  );
}

const SERVICES = ['Zoom', 'Google Meet', 'Microsoft Teams', 'Discord', 'Skype'];
const OTHER = 'Інше';
let roomKey = 0;
const toRow = (r) => ({
  key: ++roomKey, id: r.id ?? null, url: r.url ?? '', is_default: Boolean(r.is_default),
  service: SERVICES.includes(r.service) || !r.service ? (r.service ?? 'Zoom') : OTHER,
  custom: SERVICES.includes(r.service) ? '' : (r.service ?? ''),
});

/* Кабінети вчителя: сервіс і посилання. Основний підставляється, коли вчителя ставлять у розклад. */
function RoomsEditor({ rooms, setRooms }) {
  const patch = (key, p) => setRooms(rooms.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const makeMain = (key) => setRooms(rooms.map((r) => ({ ...r, is_default: r.key === key })));
  const remove = (key) => {
    const rest = rooms.filter((r) => r.key !== key);
    if (rest.length && !rest.some((r) => r.is_default)) rest[0] = { ...rest[0], is_default: true };
    setRooms(rest);
  };
  const add = () => setRooms([...rooms, { ...toRow({}), is_default: rooms.length === 0 }]);
  return (
    <fieldset className="rooms">
      <legend className="field-label">Кабінети</legend>
      {rooms.length === 0 && <p className="muted small">Додайте Zoom, Google Meet чи інший сервіс, щоб посилання саме з'являлося в розкладі.</p>}
      {rooms.map((r, i) => (
        <div key={r.key} className={`room ${r.is_default ? 'is-main' : ''}`}>
          <div className="room-head">
            <Select compact label={`Сервіс кабінету ${i + 1}`} value={r.service} onChange={(v) => patch(r.key, { service: v })}
              options={[...SERVICES, OTHER].map((s) => ({ value: s, label: s }))} />
            <IconButton label={`Прибрати кабінет ${i + 1}`} onClick={() => remove(r.key)}><IconTrash size={18} /></IconButton>
          </div>
          {r.service === OTHER && (
            <Input label={`Назва сервісу ${i + 1}`} placeholder="Наприклад, Webex" maxLength={60} required value={r.custom} onChange={(e) => patch(r.key, { custom: e.target.value })} />
          )}
          <Input label={`Посилання ${i + 1}`} type="url" placeholder="https://" maxLength={300} required value={r.url} onChange={(e) => patch(r.key, { url: e.target.value })} />
          {rooms.length > 1 && (
            r.is_default
              ? <span className="room-main">Основний: підставляється в розклад</span>
              : <Button variant="ghost" small onClick={() => makeMain(r.key)}>Зробити основним</Button>
          )}
        </div>
      ))}
      <Button variant="ghost" small icon={<IconPlus size={16} />} onClick={add}>Додати кабінет</Button>
    </fieldset>
  );
}

function PersonForm({ person, onClose, onDone }) {
  const isNew = !person.id;
  const isTeacher = person.role === 'teacher';
  const [name, setName] = useState(person.name ?? '');
  const [login, setLogin] = useState(person.login ?? '');
  const [phone, setPhone] = useState(person.phone ?? '');
  const [password, setPassword] = useState(() => (isNew ? randomPassword() : ''));
  const [rooms, setRooms] = useState(() => (person.rooms ?? []).map(toRow));
  const [avatar, setAvatar] = useState(person.avatar ?? null);
  const [run, busy] = useAction();
  const title = isNew ? (person.role === 'student' ? 'Новий учень' : 'Новий вчитель') : 'Редагувати';

  const submit = async (e) => {
    e.preventDefault();
    const roomList = rooms.map((r) => ({ id: r.id, service: r.service === OTHER ? r.custom : r.service, url: r.url.trim(), is_default: r.is_default }));
    const extra = isTeacher ? { rooms: roomList } : {};
    const ok = await run(
      () => api(isNew ? '/users' : `/users/${person.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        body: isNew ? { role: person.role, name, login, phone, password, avatar, ...extra } : { name, login, phone, avatar, ...extra },
      }),
      isNew ? 'Акаунт створено' : 'Зміни збережено'
    );
    if (ok) onDone(isNew ? { name, login, password } : null);
  };
  return (
    <Modal narrow title={title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Input label="Ім'я та прізвище" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Логін" required autoCapitalize="none" spellCheck={false} maxLength={40} hint="Латиниця, цифри, крапка, дефіс" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="off" />
        <Input label="Телефон" type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
        {isNew && <PasswordInput generate value={password} onChange={setPassword} autoComplete="new-password" minLength={8} required hint="Мінімум 8 символів" />}
        <fieldset className="look-set">
          <legend>Аватарка</legend>
          <AvatarPicker value={avatar} onChange={setAvatar} name={name} />
        </fieldset>
        {isTeacher && <RoomsEditor rooms={rooms} setRooms={setRooms} />}
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy}>{isNew ? 'Створити' : 'Зберегти'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetForm({ person, onClose, onDone }) {
  const [password, setPassword] = useState(() => randomPassword());
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(() => api(`/users/${person.id}/password`, { method: 'POST', body: { password } }), 'Пароль змінено');
    if (ok) onDone({ name: person.name, login: person.login, password });
  };
  return (
    <Modal narrow title={`Новий пароль: ${person.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <PasswordInput generate label="Новий пароль" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} required />
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Назад</Button>
          <Button type="submit" busy={busy}>Змінити пароль</Button>
        </div>
      </form>
    </Modal>
  );
}

function CredentialsNote({ data, onClose }) {
  const { toast } = useUI();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Логін: ${data.login}\nПароль: ${data.password}`);
      toast('Скопійовано');
    } catch {
      toast('Скопіюйте дані вручну', 'error');
    }
  };
  return (
    <Modal narrow title="Дані для входу" onClose={onClose}>
      <p className="muted small">Передайте їх: {data.name}. Пароль більше не показуватиметься.</p>
      <dl className="creds">
        <div><dt>Логін</dt><dd>{data.login}</dd></div>
        <div><dt>Пароль</dt><dd>{data.password}</dd></div>
      </dl>
      <div className="form-actions">
        <Button variant="ghost" onClick={copy}>Скопіювати</Button>
        <Button onClick={onClose}>Готово</Button>
      </div>
    </Modal>
  );
}
