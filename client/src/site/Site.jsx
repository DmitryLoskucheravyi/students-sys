/*
 * Сайт школи: головна з превʼю, курси, ціни, відгуки. Курси, ціни, відгуки й контакти — з кабінету наживо.
 * «Записатись» відкриває форму заявки; заявка йде менеджеру в кабінет і, якщо налаштовано, у Telegram.
 */
import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import BsLogo from '../BsLogo.jsx';
import { Button, IconButton, Input, Modal, Textarea } from '../ui.jsx';
import { IconFacebook, IconInstagram, IconTelegram, IconTiktok, IconSpark, IconClose, IconMenu, IconPhone, IconSend, IconTick, IconUser } from '../icons.jsx';
import { CoursePage, CoursesPage, Home, NotFound, PricesPage, ProjectsPage, ReviewsPage } from './pages.jsx';
import { socialLinks, LeadCtx, SiteCtx, prettyPhone, telHref, useSite } from './ctx.js';
import '@fontsource-variable/nunito';
import './site.css';

/* ───────── Дані сайту: один запит на все, кешується на час відвідування ───────── */

function useSiteData() {
  const [state, setState] = useState({ data: null, error: null });
  const load = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
    api('/site').then((data) => setState({ data, error: null })).catch((error) => setState({ data: null, error }));
  }, []);
  useEffect(load, [load]);
  return { ...state, reload: load };
}

/* ───────── Заявка ───────── */

function LeadModal({ note: initialNote, phone, onClose }) {
  const [name, setName] = useState('');
  const [tel, setTel] = useState('');
  const [note, setNote] = useState(initialNote ?? '');
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/site/leads', { method: 'POST', body: { name, phone: tel, note, website: trap } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={done ? 'Заявку надіслано' : 'Записатись'} onClose={onClose} narrow
      badge={!done && <><IconSpark size={18} /><span>Пробне заняття <b>безкоштовно</b></span></>}>
      {done ? (
        <div className="lead-done" role="status">
          <span className="lead-done-mark" aria-hidden="true"><IconTick size={34} /></span>
          <p><strong>Дякуємо, {name.trim().split(' ')[0]}!</strong></p>
          <p className="muted">Ми зателефонуємо найближчим часом.</p>
          <Button className="btn-wide" onClick={onClose}>Готово</Button>
        </div>
      ) : (
        <form className="lead-form" onSubmit={submit}>
          <Input label="Ім'я" autoComplete="name" maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Телефон" type="tel" inputMode="tel" autoComplete="tel" maxLength={24} required placeholder="+380 __ ___ __ __"
            value={tel} onChange={(e) => setTel(e.target.value)} />
          <Textarea label="Додатково" hint="Необов'язково" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          {/* Пастка для ботів: людина цього поля не бачить */}
          <div className="lead-trap" aria-hidden="true">
            <label>Сайт<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" busy={busy} className="btn-wide" icon={<IconSend size={18} />}>{busy ? 'Надсилаємо…' : 'Надіслати заявку'}</Button>
        </form>
      )}
      {phone && !done && (
        <>
          <div className="or-line"><span>або</span></div>
          <a className="btn btn-ghost btn-wide call-btn" href={telHref(phone)}><IconPhone size={18} /><span>Зателефонувати</span></a>
          <p className="call-number">{prettyPhone(phone)}</p>
        </>
      )}
    </Modal>
  );
}

/* ───────── Шапка, меню, футер ───────── */

const NAV = [
  ['/courses', 'Курси'],
  ['/projects', 'Проєкти'],
  ['/prices', 'Ціни'],
  ['/reviews', 'Відгуки'],
];

function Header({ onLead }) {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMenu(false); }, [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    if (!menu) return undefined;
    const key = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('keydown', key);
    document.body.classList.add('no-scroll');
    return () => { document.removeEventListener('keydown', key); document.body.classList.remove('no-scroll'); };
  }, [menu]);

  // Меню — поза шапкою: її backdrop-filter робить fixed-нащадків прив'язаними до шапки (Safari)
  return (
    <>
    <header className={`s-head ${scrolled ? 'is-scrolled' : ''} ${menu ? 'is-open' : ''}`}>
      <div className="s-wrap s-head-in">
        <Link to="/" className="s-logo" aria-label="Be Smart School — на головну"><BsLogo className="is-site" /></Link>
        <nav className="s-nav" aria-label="Розділи сайту">
          {NAV.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
          <a href="/cabinet" className="s-nav-cabinet"><IconUser size={18} />Для учнів</a>
        </nav>
        <Button className="s-head-cta" onClick={() => onLead()}>Записатись</Button>
        <IconButton className="s-burger" label={menu ? 'Закрити меню' : 'Меню'} aria-expanded={menu} aria-controls="s-menu" onClick={() => setMenu(!menu)}>
          {menu ? <IconClose /> : <IconMenu />}
        </IconButton>
      </div>
    </header>
      {menu && (
        <div className="s-menu" id="s-menu">
          <nav aria-label="Меню">
            <Link to="/">Головна</Link>
            {NAV.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
            <a href="/cabinet" className="s-menu-cabinet"><IconUser size={20} />Для учнів</a>
          </nav>
          <Socials className="is-menu" />
          <Button className="btn-wide" onClick={() => { setMenu(false); onLead(); }}>Записатись</Button>
        </div>
      )}
    </>
  );
}

const SOCIAL_ICON = { instagram: IconInstagram, tiktok: IconTiktok, facebook: IconFacebook, telegram: IconTelegram };

/** Ряд круглих іконок соцмереж (лише заповнені в кабінеті). */
function Socials({ className = '' }) {
  const links = socialLinks(useSite().data?.contacts);
  if (!links.length) return null;
  return (
    <div className={`s-socials ${className}`}>
      {links.map(({ key, label, href }) => {
        const Icon = SOCIAL_ICON[key];
        return <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}><Icon size={20} /></a>;
      })}
    </div>
  );
}

function Footer() {
  const { data } = useSite();
  const c = data?.contacts ?? {};
  return (
    <footer className="s-foot">
      <div className="s-wrap s-foot-in">
        <div className="s-foot-brand">
          <Link to="/" aria-label="Be Smart School — на головну"><BsLogo className="is-foot" /></Link>
          <Socials className="is-foot" />
        </div>
        <nav className="s-foot-col" aria-label="Розділи сайту">
          <h2>Сайт</h2>
          {NAV.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
          <a href="/cabinet">Для учнів</a>
        </nav>
        {(c.phone || c.email || c.address) && (
          <div className="s-foot-col">
            <h2>Контакти</h2>
            {c.phone && <a href={telHref(c.phone)}>{prettyPhone(c.phone)}</a>}
            {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
            {c.address && <p>{c.address}</p>}
          </div>
        )}
      </div>
      <div className="s-wrap s-foot-bottom">
        <span>© {new Date().getFullYear()} Be Smart School</span>
      </div>
    </footer>
  );
}

/** На новій сторінці — вгору й назва вкладки. */
function PageEffects() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return null;
}

export default function Site() {
  const site = useSiteData();
  const [lead, setLead] = useState(null);
  const openLead = useCallback((note = '') => setLead({ note }), []);

  // Сайт завжди світлий: червоно-біла айдентика. Тема кабінету тут не діє.
  useEffect(() => { document.documentElement.dataset.theme = 'light'; }, []);

  return (
    <SiteCtx.Provider value={site}>
      <LeadCtx.Provider value={openLead}>
        <BrowserRouter>
          <PageEffects />
          <div className="site">
            <Header onLead={openLead} />
            <main className="s-main">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/courses/:id" element={<CoursePage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/prices" element={<PricesPage />} />
                <Route path="/reviews" element={<ReviewsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
          </div>
          {lead && <LeadModal note={lead.note} phone={site.data?.contacts?.phone} onClose={() => setLead(null)} />}
        </BrowserRouter>
      </LeadCtx.Provider>
    </SiteCtx.Provider>
  );
}
