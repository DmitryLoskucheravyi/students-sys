/*
 * Сайт школи в кабінеті менеджера: заявки з форми «Записатись», відгуки, що показувати на сайті, контакти.
 * Курси й види абонементів беруться з системи; тут лише вибір, які з них бачить відвідувач.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, uploadForm, useData } from '../api.js';
import { CourseIcon } from '../courseLook.jsx';
import { dateTimeShort, lessonsWord, money } from '../fmt.js';
import { Button, Checkbox, Empty, ErrorNote, IconButton, Input, Loader, Modal, PageTools, Segmented, Select, Status, Textarea, useAction, useUI } from '../ui.jsx';
import { IconBell, IconEdit, IconExternal, IconImage, IconPhone, IconPlus, IconQuote, IconRestore, IconTick, IconTrash } from '../icons.jsx';

const TABS = [
  { value: 'leads', label: 'Заявки' },
  { value: 'reviews', label: 'Відгуки' },
  { value: 'projects', label: 'Проєкти' },
  { value: 'showcase', label: 'На сайті' },
  { value: 'contacts', label: 'Контакти' },
];
const notify = () => window.dispatchEvent(new Event('bs:notify'));
const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

export default function SiteAdmin() {
  // Вкладка — в адресі (?tab=…): після оновлення сторінки чи з посилання відкривається та сама.
  // Перемикається одразу з власного стану, а адреса підтягується слідом (роутер оновлює її в переході).
  const [params, setParams] = useSearchParams();
  const [tab, setTabState] = useState(() => (TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'leads'));
  const setTab = (value) => {
    setTabState(value);
    setParams(value === 'leads' ? {} : { tab: value }, { replace: true });
  };
  const [editing, setEditing] = useState(null);
  const [project, setProject] = useState(null);
  const reviews = useData(tab === 'reviews' ? '/site-admin/reviews' : null);
  const projects = useData(tab === 'projects' ? '/site-admin/projects' : null);
  return (
    <div>
      <PageTools title="Сайт" filtered={tab !== 'leads'} filters={<Segmented value={tab} onChange={setTab} options={TABS} />}>
        {tab === 'reviews' && <Button icon={<IconPlus size={18} />} onClick={() => setEditing({})}>Новий відгук</Button>}
        {tab === 'projects' && <Button icon={<IconPlus size={18} />} onClick={() => setProject({})}>Новий проєкт</Button>}
        {tab !== 'reviews' && tab !== 'projects' && <a className="btn btn-ghost" href="/" target="_blank" rel="noreferrer"><IconExternal size={18} /><span>Відкрити сайт</span></a>}
      </PageTools>
      {tab === 'leads' && <Leads />}
      {tab === 'reviews' && <Reviews state={reviews} onEdit={setEditing} />}
      {tab === 'projects' && <Projects state={projects} onEdit={setProject} />}
      {tab === 'showcase' && <Showcase />}
      {tab === 'contacts' && <Contacts />}
      {project && <ProjectForm project={project} onClose={() => setProject(null)} onSaved={() => { setProject(null); projects.reload(); }} />}
      {editing && <ReviewForm review={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reviews.reload(); }} />}
    </div>
  );
}

/* ───────── Заявки ───────── */

function Leads() {
  const { data, error, loading, reload } = useData('/site-admin/leads');
  const [run] = useAction();
  const { confirm } = useUI();
  useEffect(() => {
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, [reload]);

  const mark = async (l, status) => {
    if (await run(() => api(`/site-admin/leads/${l.id}`, { method: 'PATCH', body: { status } }))) { reload(); notify(); }
  };
  const remove = async (l) => {
    if (!(await confirm({ title: `Видалити заявку «${l.name}»?`, action: 'Видалити', danger: true }))) return;
    if (await run(() => api(`/site-admin/leads/${l.id}`, { method: 'DELETE' }), 'Заявку видалено')) { reload(); notify(); }
  };

  if (error) return <ErrorNote text={error} onRetry={reload} />;
  if (!data) return loading ? <Loader /> : null;
  if (!data.length) return <Empty icon={<IconBell size={36} />} title="Заявок ще немає" />;
  return (
    <ul className="rows">
      {data.map((l) => (
        <li key={l.id} className={`row lead-row ${l.status === 'done' ? 'is-done' : ''}`}>
          <div className="row-main">
            <h3>{l.name}</h3>
            <p><a className="lead-phone" href={telHref(l.phone)}><IconPhone size={16} />{l.phone}</a></p>
            {l.note && <p className="small lead-note">{l.note}</p>}
            <p className="muted small">{dateTimeShort(String(l.created_at).replace('T', ' '))}</p>
          </div>
          {l.status === 'new' ? <Status kind="scheduled">Нова</Status> : <Status kind="completed">Опрацьовано</Status>}
          <div className="row-actions">
            {l.status === 'new'
              ? <IconButton label="Опрацьовано" onClick={() => mark(l, 'done')}><IconTick size={20} /></IconButton>
              : <IconButton label="Повернути в нові" onClick={() => mark(l, 'new')}><IconRestore size={20} /></IconButton>}
            <IconButton label="Видалити" onClick={() => remove(l)}><IconTrash size={20} /></IconButton>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ───────── Відгуки ───────── */

function Reviews({ state, onEdit }) {
  const { data, error, loading, reload } = state;
  const [run] = useAction();
  const { confirm } = useUI();
  const remove = async (r) => {
    if (!(await confirm({ title: `Видалити відгук «${r.author}»?`, action: 'Видалити', danger: true }))) return;
    if (await run(() => api(`/site-admin/reviews/${r.id}`, { method: 'DELETE' }), 'Відгук видалено')) reload();
  };
  if (error) return <ErrorNote text={error} onRetry={reload} />;
  if (!data) return loading ? <Loader /> : null;
  if (!data.length) return <Empty icon={<IconQuote size={36} />} title="Відгуків ще немає" action={<Button icon={<IconPlus size={18} />} onClick={() => onEdit({})}>Новий відгук</Button>} />;
  return (
    <ul className="rows">
      {data.map((r) => (
        <li key={r.id} className="row review-row">
          <div className="row-main">
            <h3>{r.author}</h3>
            {(r.author_role || r.course_title) && <p className="muted small">{[r.author_role, r.course_title].filter(Boolean).join(', ')}</p>}
            <p className="review-text">{r.text}</p>
          </div>
          {!r.is_published && <Status kind="cancelled">Прихований</Status>}
          <div className="row-actions">
            <IconButton label="Редагувати" onClick={() => onEdit(r)}><IconEdit size={20} /></IconButton>
            <IconButton label="Видалити" onClick={() => remove(r)}><IconTrash size={20} /></IconButton>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ReviewForm({ review, onClose, onSaved }) {
  const isNew = !review.id;
  const [author, setAuthor] = useState(review.author ?? '');
  const [role, setRole] = useState(review.author_role ?? '');
  const [courseId, setCourseId] = useState(review.course_id ?? null);
  const [text, setText] = useState(review.text ?? '');
  const [published, setPublished] = useState(review.is_published !== 0);
  const { data: showcase } = useData('/site-admin/showcase');
  const [run, busy] = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const body = { author, author_role: role, course_id: courseId, text, is_published: published };
    const ok = await run(() => api(isNew ? '/site-admin/reviews' : `/site-admin/reviews/${review.id}`, { method: isNew ? 'POST' : 'PATCH', body }), isNew ? 'Відгук додано' : 'Зміни збережено');
    if (ok) onSaved();
  };
  return (
    <Modal title={isNew ? 'Новий відгук' : 'Відгук'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <Input label="Ім'я" required maxLength={80} value={author} onChange={(e) => setAuthor(e.target.value)} />
          <Input label="Хто це" hint="Наприклад: учень, мама учня" maxLength={60} value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <Select label="Курс" value={courseId} onChange={setCourseId} clearable placeholder="Без курсу"
          options={(showcase?.courses ?? []).map((c) => ({ value: c.id, label: c.title, icon: <CourseIcon course={c} size={16} /> }))} />
        <Textarea label="Відгук" required rows={6} maxLength={1200} value={text} onChange={(e) => setText(e.target.value)} />
        <Checkbox checked={published} onChange={setPublished}>Показувати на сайті</Checkbox>
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Скасувати</Button>
          <Button type="submit" busy={busy}>{isNew ? 'Додати' : 'Зберегти'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────── Проєкти учнів ───────── */

const imageUrl = (name) => `/api/site-admin/images/${name}`;

/** Скрін зменшується в браузері до 1600 px по довшій стороні й стискається у WEBP: швидше вантажиться на сайті. */
async function shrinkImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
    return blob && blob.size < file.size ? new File([blob], 'project.webp', { type: 'image/webp' }) : file;
  } catch {
    return file;
  }
}

function Projects({ state, onEdit }) {
  const { data, error, loading, reload } = state;
  const [run] = useAction();
  const { confirm } = useUI();
  const remove = async (p) => {
    if (!(await confirm({ title: `Видалити проєкт «${p.title}»?`, action: 'Видалити', danger: true }))) return;
    if (await run(() => api(`/site-admin/projects/${p.id}`, { method: 'DELETE' }), 'Проєкт видалено')) reload();
  };
  if (error) return <ErrorNote text={error} onRetry={reload} />;
  if (!data) return loading ? <Loader /> : null;
  if (!data.length) return <Empty icon={<IconImage size={36} />} title="Проєктів ще немає" action={<Button icon={<IconPlus size={18} />} onClick={() => onEdit({})}>Новий проєкт</Button>} />;
  return (
    <ul className="rows">
      {data.map((p) => (
        <li key={p.id} className="row project-row">
          <span className="project-thumb">{p.image ? <img src={imageUrl(p.image)} alt="" loading="lazy" /> : <IconImage size={22} />}</span>
          <div className="row-main">
            <h3>{p.title}</h3>
            {(p.author || p.course_title) && <p className="muted small">{[p.author, p.course_title].filter(Boolean).join(', ')}</p>}
            {p.url && <p className="small"><a href={p.url} target="_blank" rel="noopener noreferrer" className="lead-phone">{p.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a></p>}
          </div>
          {!p.is_published && <Status kind="cancelled">Прихований</Status>}
          <div className="row-actions">
            <IconButton label="Редагувати" onClick={() => onEdit(p)}><IconEdit size={20} /></IconButton>
            <IconButton label="Видалити" onClick={() => remove(p)}><IconTrash size={20} /></IconButton>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ProjectForm({ project, onClose, onSaved }) {
  const isNew = !project.id;
  const [title, setTitle] = useState(project.title ?? '');
  const [author, setAuthor] = useState(project.author ?? '');
  const [courseId, setCourseId] = useState(project.course_id ?? null);
  const [url, setUrl] = useState(project.url ?? '');
  const [description, setDescription] = useState(project.description ?? '');
  const [image, setImage] = useState(project.image ?? null);
  const [published, setPublished] = useState(project.is_published !== 0);
  const fileRef = useRef(null);
  const { data: showcase } = useData('/site-admin/showcase');
  const [run, busy] = useAction();
  const [upload, uploading] = useAction();

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const form = new FormData();
    form.append('image', await shrinkImage(file));
    const r = await upload(() => uploadForm('/site-admin/images', form));
    if (r) setImage(r.image);
  };
  const submit = async (e) => {
    e.preventDefault();
    const body = { title, author, course_id: courseId, url, description, image, is_published: published };
    const ok = await run(() => api(isNew ? '/site-admin/projects' : `/site-admin/projects/${project.id}`, { method: isNew ? 'POST' : 'PATCH', body }), isNew ? 'Проєкт додано' : 'Зміни збережено');
    if (ok) onSaved();
  };
  return (
    <Modal title={isNew ? 'Новий проєкт' : 'Проєкт'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="project-image">
          <div className="project-image-box">{image ? <img src={imageUrl(image)} alt="Скрін проєкту" /> : <IconImage size={30} />}</div>
          <div className="project-image-tools">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={pick} aria-label="Скрін проєкту" />
            <Button variant="ghost" small busy={uploading} icon={<IconImage size={16} />} onClick={() => fileRef.current?.click()}>{uploading ? 'Завантажуємо…' : image ? 'Замінити скрін' : 'Додати скрін'}</Button>
            {image && <Button variant="ghost" small onClick={() => setImage(null)}>Прибрати</Button>}
          </div>
        </div>
        <Input label="Назва" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="form-row">
          <Input label="Автор" hint="Як підписати: ім'я чи «учень, 12 років»" maxLength={80} value={author} onChange={(e) => setAuthor(e.target.value)} />
          <Select label="Курс" value={courseId} onChange={setCourseId} clearable placeholder="Без курсу"
            options={(showcase?.courses ?? []).map((c) => ({ value: c.id, label: c.title, icon: <CourseIcon course={c} size={16} /> }))} />
        </div>
        <Input label="Посилання на проєкт" hint="Сайт, гра, GitHub" inputMode="url" maxLength={300} placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Textarea label="Опис" rows={3} maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} />
        <Checkbox checked={published} onChange={setPublished}>Показувати на сайті</Checkbox>
        <div className="form-actions">
          <Button variant="ghost" onClick={onClose}>Скасувати</Button>
          <Button type="submit" busy={busy} disabled={uploading}>{isNew ? 'Додати' : 'Зберегти'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────── Що показувати на сайті ───────── */

function Showcase() {
  const { data, error, loading, reload, setData } = useData('/site-admin/showcase');
  const [run] = useAction();
  if (error) return <ErrorNote text={error} onRetry={reload} />;
  if (!data) return loading ? <Loader /> : null;

  // Зміна застосовується одразу: відправляємо повний список того, що показувати.
  const save = async (next) => {
    const r = await run(() => api('/site-admin/showcase', {
      method: 'PUT',
      body: { course_ids: next.courses.filter((c) => c.on_site).map((c) => c.id), plan_ids: next.plans.filter((p) => p.on_site).map((p) => p.id) },
    }), 'Збережено');
    if (r) setData(r);
  };
  const toggle = (kind, item, on) => save({ ...data, [kind]: data[kind].map((x) => (x.id === item.id ? { ...x, on_site: on ? 1 : 0 } : x)) });

  return (
    <div className="showcase">
      <section>
        <h2>Курси</h2>
        {data.courses.length ? (
          <ul className="showcase-list">
            {data.courses.map((c) => (
              <li key={c.id}>
                <Checkbox checked={Boolean(c.on_site)} onChange={(on) => toggle('courses', c, on)}>
                  <span className="showcase-item"><CourseIcon course={c} size={18} />{c.title}</span>
                </Checkbox>
              </li>
            ))}
          </ul>
        ) : <p className="muted">Курсів ще немає.</p>}
      </section>
      <section>
        <h2>Абонементи</h2>
        {data.plans.length ? (
          <ul className="showcase-list">
            {data.plans.map((p) => (
              <li key={p.id}>
                <Checkbox checked={Boolean(p.on_site)} disabled={!p.is_active && !p.on_site} onChange={(on) => toggle('plans', p, on)}>
                  <span className="showcase-item">
                    <i className={`tk-dot tk-${p.color}`} />{p.name}
                    <small className="muted">{lessonsWord(p.lessons_count)}, {money(p.price_per_lesson)}{!p.is_active && ', в архіві'}</small>
                  </span>
                </Checkbox>
              </li>
            ))}
          </ul>
        ) : <p className="muted">Видів абонементів ще немає.</p>}
      </section>
    </div>
  );
}

/* ───────── Контакти ───────── */

function Contacts() {
  const { data, error, loading, reload } = useData('/site-admin/settings');
  if (error) return <ErrorNote text={error} onRetry={reload} />;
  if (!data) return loading ? <Loader /> : null;
  return <ContactsForm initial={data} onSaved={reload} />;
}

function ContactsForm({ initial, onSaved }) {
  const [v, setV] = useState(initial);
  const [run, busy] = useAction();
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const r = await run(() => api('/site-admin/settings', { method: 'PUT', body: v }), 'Контакти збережено');
    if (r) { setV(r); onSaved(); }
  };
  return (
    <form className="form contacts-form" onSubmit={submit}>
      <div className="form-row">
        <Input label="Телефон" hint="Для кнопки «Зателефонувати»" type="tel" inputMode="tel" placeholder="+380 67 123 45 67" value={v.phone} onChange={set('phone')} />
        <Input label="Email" type="email" value={v.email} onChange={set('email')} />
      </div>
      <div className="form-row">
        <Input label="Telegram" placeholder="@school або https://t.me/…" value={v.telegram} onChange={set('telegram')} />
        <Input label="Instagram" placeholder="@school або посилання" value={v.instagram} onChange={set('instagram')} />
      </div>
      <div className="form-row">
        <Input label="TikTok" placeholder="@school або посилання" value={v.tiktok ?? ''} onChange={set('tiktok')} />
        <Input label="Facebook" placeholder="Посилання на сторінку" value={v.facebook ?? ''} onChange={set('facebook')} />
      </div>
      <Input label="Адреса" maxLength={300} value={v.address} onChange={set('address')} />
      <div className="form-actions start">
        <Button type="submit" busy={busy}>Зберегти</Button>
      </div>
    </form>
  );
}
