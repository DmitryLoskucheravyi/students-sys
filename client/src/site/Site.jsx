/*
 * Сайт школи: головна з превʼю, курси, ціни, відгуки. Курси, ціни, відгуки й контакти — з кабінету наживо.
 * «Записатись» відкриває форму заявки; заявка йде менеджеру в кабінет і, якщо налаштовано, у Telegram.
 * Під час збірки сторінки рендеряться заздалегідь (ssr.jsx, scripts/prerender.mjs): пошуковики й ШІ-боти
 * одразу отримують увесь текст. Браузер бере зібрані дані зі сторінки (#site-boot) і тихо оновлює їх з API.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import BsLogo from '../BsLogo.jsx';
import { RouteBoundary } from '../ErrorBoundary.jsx';
import { Button, IconButton, Input, Modal, Textarea } from '../ui.jsx';
import { IconRight, IconFacebook, IconInstagram, IconTelegram, IconTiktok, IconSpark, IconClose, IconMenu, IconPhone, IconSend, IconTick, IconUser } from '../icons.jsx';
import { CoursePage, CoursesPage, FaqPage, Home, NotFound, PricesPage, PrivacyPage, ProjectsPage, ReviewsPage } from './pages.jsx';
import { socialLinks, BootCtx, LeadCtx, SiteCtx, prettyPhone, telHref, useSite } from './ctx.js';
import { directionPath } from './seo.js';
import '@fontsource-variable/nunito';
import './themes.css';
import './site.css';

/* ───────── Дані сайту: один запит на все, кешується на час відвідування ───────── */

function useSiteData(initial) {
  const [state, setState] = useState({ data: initial ?? null, error: null });
  const load = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
    // Повторне завантаження не вдалося — вже показані дані лишаються, додається лише помилка
    api('/site').then((data) => setState({ data, error: null })).catch((error) => setState((s) => ({ data: s.data, error })));
  }, []);
  useEffect(load, [load]);
  // Той самий обʼєкт, доки дані не змінились: сторінки не перемальовуються, коли відкривається форма заявки
  return useMemo(() => ({ ...state, reload: load }), [state, load]);
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
    <Modal title={done ? 'Заявку надіслано' : 'Запис'} onClose={onClose} narrow
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
          <p className="lead-consent">Надсилаючи заявку, ви погоджуєтеся з <a href="/privacy" target="_blank" rel="noopener">політикою конфіденційності</a>.</p>
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
          {/* Клік по посиланню закриває меню одразу, не чекаючи зміни адреси */}
          <nav aria-label="Меню" onClick={(e) => { if (e.target.closest('a')) setMenu(false); }}>
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
  return (
    <div className={`s-socials ${className}`}>
      {links.map(({ key, label, href }) => {
        const Icon = SOCIAL_ICON[key];
        // Поки посилання не задане в кабінеті — іконка-заглушка без переходу
        return href
          ? <a key={key} href={href} target="_blank" rel="noopener me" aria-label={label} title={label}><Icon size={20} /></a>
          : <span key={key} className="is-stub" aria-hidden="true"><Icon size={20} /></span>;
      })}
    </div>
  );
}

function Footer() {
  const { data } = useSite();
  const c = data?.contacts ?? {};
  const dirs = data?.directions ?? [];
  return (
    <footer className="s-foot">
      <div className="s-wrap s-foot-top">
        <nav className="s-foot-nav" aria-label="Розділи сайту">
          {NAV.map(([to, label]) => <Link key={to} to={to}>{label}<IconRight size={20} /></Link>)}
          <Link to="/faq">Питання<IconRight size={20} /></Link>
          <a href="/cabinet">Для учнів<IconRight size={20} /></a>
        </nav>
      </div>
      <div className="s-wrap s-foot-in">
        <div className="s-foot-brand">
          <Link to="/" aria-label="Be Smart School — на головну"><BsLogo className="is-foot" /></Link>
          <p className="s-foot-about">Онлайн-школа програмування для дітей і підлітків.</p>
          <Socials className="is-foot" />
        </div>
        {dirs.length > 0 && (
          <nav className="s-foot-col" aria-label="Курси">
            <h2>Курси</h2>
            {dirs.map((d) => <Link key={d.id} to={directionPath(d, dirs)}>{d.title}</Link>)}
          </nav>
        )}
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
        <Link to="/privacy">Політика конфіденційності</Link>
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

/** Дані, з якими сторінку зібрано (вписує scripts/prerender.mjs). Не виконується як скрипт, тож CSP не заважає. */
function readBoot() {
  try { return JSON.parse(document.getElementById('site-boot')?.textContent || '{}'); } catch { return {}; }
}

export default function Site() {
  const [boot] = useState(readBoot);
  return <SiteApp boot={boot} Router={BrowserRouter} />;
}

/** Увесь сайт. Router — BrowserRouter у браузері, StaticRouter під час збірки (ssr.jsx). */
export function SiteApp({ boot = {}, Router, routerProps }) {
  const site = useSiteData(boot.site);
  const [lead, setLead] = useState(null);
  const openLead = useCallback((note = '') => setLead({ note }), []);

  // Сайт завжди світлий: фіолетова палітра (themes.css). Тема кабінету тут не діє.
  useEffect(() => { document.documentElement.dataset.theme = 'light'; }, []);

  return (
    <BootCtx.Provider value={boot}>
    <SiteCtx.Provider value={site}>
      <LeadCtx.Provider value={openLead}>
        <Router {...routerProps}>
          <PageEffects />
          <div className="site">
            <Header onLead={openLead} />
            <main className="s-main">
              <RouteBoundary>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/courses" element={<CoursesPage />} />
                  <Route path="/courses/:slug" element={<CoursePage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/prices" element={<PricesPage />} />
                  <Route path="/reviews" element={<ReviewsPage />} />
                  <Route path="/faq" element={<FaqPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </RouteBoundary>
            </main>
            <Footer />
          </div>
          {lead && <LeadModal note={lead.note} phone={site.data?.contacts?.phone} onClose={() => setLead(null)} />}
        </Router>
      </LeadCtx.Provider>
    </SiteCtx.Provider>
    </BootCtx.Provider>
  );
}
