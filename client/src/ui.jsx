import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from './session.jsx';
import { IconCalendar, IconClock, IconClose, IconDice, IconDown, IconEye, IconEyeOff, IconFilters, IconLeft, IconMinus, IconPlus, IconRight, IconTick } from './icons.jsx';
import { MONTHS, WEEKDAYS, addDays, parseDate, randomPassword, shortDate, toISO, todayISO, weekdayOf } from './fmt.js';

/* Тости та підтвердження */
const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);

  const toast = useCallback((text, kind = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);
  const confirm = useCallback(
    (opts) => new Promise((resolve) => setDialog({ ...opts, resolve })),
    []
  );
  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const close = (answer) => {
    dialog.resolve(answer);
    setDialog(null);
  };
  return (
    <UICtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === 'ok' ? <IconTick size={18} /> : <IconClose size={18} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      {dialog && (
        <Modal title={dialog.title} onClose={() => close(false)} narrow>
          {dialog.text && <p className="muted">{dialog.text}</p>}
          <div className="form-actions">
            <Button variant="ghost" onClick={() => close(false)}>Назад</Button>
            <Button variant={dialog.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{dialog.action}</Button>
          </div>
        </Modal>
      )}
    </UICtx.Provider>
  );
}

/** Виконує дію, показує помилку тостом і блокує кнопку на час запиту. */
export function useAction() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, success) => {
    setBusy(true);
    try {
      const result = await fn();
      if (success) toast(success);
      return result ?? true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }, [toast]);
  return [run, busy];
}

/* Кнопки */
export function Button({ variant = 'primary', icon, busy, children, className = '', small, ...p }) {
  return (
    <button type="button" className={`btn btn-${variant} ${small ? 'btn-small' : ''} ${className}`} disabled={busy || p.disabled} {...p}>
      {icon}
      {children && <span>{children}</span>}
    </button>
  );
}
export function IconButton({ label, children, className = '', ...p }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...p}>
      {children}
    </button>
  );
}

/* Поля */
export function Field({ label, hint, children, id }) {
  return (
    <div className="field">
      {label && <label className="field-label" htmlFor={id} id={id ? `${id}-label` : undefined}>{label}</label>}
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}
export function Input({ label, hint, ...p }) {
  const id = useId();
  return <Field label={label} hint={hint} id={id}><input id={id} className="input" {...p} /></Field>;
}
export function Textarea({ label, hint, rows = 3, ...p }) {
  const id = useId();
  return <Field label={label} hint={hint} id={id}><textarea id={id} rows={rows} className="input textarea" {...p} /></Field>;
}
export function PasswordInput({ label = 'Пароль', hint, value, onChange, generate, ...p }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint} id={id}>
      <div className="input-group">
        <input id={id} className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} {...p} />
        {generate && (
          <IconButton label="Згенерувати пароль" onClick={() => { onChange(randomPassword()); setShow(true); }}><IconDice size={20} /></IconButton>
        )}
        <IconButton label={show ? 'Сховати пароль' : 'Показати пароль'} onClick={() => setShow(!show)}>
          {show ? <IconEyeOff size={20} /> : <IconEye size={20} />}
        </IconButton>
      </div>
    </Field>
  );
}
export function Stepper({ label, hint, value, onChange, min = 0, max = 100000, step = 1, suffix }) {
  const id = useId();
  const n = Number(value) || 0;
  const set = (v) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <Field label={label} hint={hint} id={id}>
      <div className="stepper">
        <IconButton label="Менше" disabled={n <= min} onClick={() => set(n - step)}><IconMinus size={18} /></IconButton>
        <input id={id} inputMode="decimal" className="stepper-input" value={value}
          onChange={(e) => { if (/^\d*[.,]?\d{0,2}$/.test(e.target.value)) onChange(e.target.value.replace(',', '.')); }}
          onBlur={() => set(n)} />
        {suffix && <span className="stepper-suffix">{suffix}</span>}
        <IconButton label="Більше" disabled={n >= max} onClick={() => set(n + step)}><IconPlus size={18} /></IconButton>
      </div>
    </Field>
  );
}

/** Плавно розгортає вміст. Згорнутий вміст недоступний для клавіатури та читалок екрана. */
export function Collapse({ open, children }) {
  return (
    <div className={`collapse ${open ? 'is-open' : ''}`} inert={!open}>
      <div className="collapse-inner">{children}</div>
    </div>
  );
}

export function Checkbox({ checked, onChange, children, disabled, readOnly }) {
  if (readOnly) {
    return (
      <span className={`check is-readonly ${checked ? 'is-on' : ''}`}>
        <span className="check-box" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 12.500l4.700 5.300L19 6.500" pathLength="1" /></svg>
        </span>
        <span>{children}</span>
        <span className="sr">{checked ? ', пройдено' : ', не пройдено'}</span>
      </span>
    );
  }
  return (
    <label className={`check ${checked ? 'is-on' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-box" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M5 12.500l4.700 5.300L19 6.500" pathLength="1" /></svg>
      </span>
      {children && <span>{children}</span>}
    </label>
  );
}

export function Segmented({ label, value, onChange, options }) {
  const name = useId();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="field">
      {label && <div className="field-label">{label}</div>}
      <div className="segmented" role="radiogroup" aria-label={label} style={{ '--n': options.length, '--i': index }}>
        <span className="segmented-thumb" aria-hidden="true" />
        {options.map((o) => (
          <label key={o.value} className={o.value === value ? 'is-on' : ''}>
            <input type="radio" name={name} checked={o.value === value} onChange={() => onChange(o.value)} />
            {o.icon}
            <span>{o.label}</span>
            {o.count != null && <span className="segmented-count">{o.count}</span>}
          </label>
        ))}
      </div>
    </div>
  );
}

export function WeekdayPicker({ label, value, onChange }) {
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  return (
    <div className="field">
      {label && <div className="field-label">{label}</div>}
      <div className="weekdays">
        {WEEKDAYS.map((w, i) => (
          <button key={w} type="button" aria-pressed={value.includes(i + 1)} className={value.includes(i + 1) ? 'is-on' : ''} onClick={() => toggle(i + 1)}>{w}</button>
        ))}
      </div>
    </div>
  );
}

/* Спливаюче вікно: живе в body, щоб модалка його не обрізала */
function Popover({ anchor, onClose, children, width }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({ visibility: 'hidden' });

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const el = ref.current;
      if (!a || !el) return;
      const w = width ?? a.width;
      const h = el.offsetHeight;
      const below = window.innerHeight - a.bottom;
      const top = below < h + 12 && a.top > below ? Math.max(8, a.top - h - 6) : a.bottom + 6;
      const left = Math.max(8, Math.min(a.left, window.innerWidth - w - 8));
      setStyle({ top, left, width: w });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, width]);

  useEffect(() => {
    const down = (e) => {
      if (!ref.current?.contains(e.target) && !anchor.current?.contains(e.target)) onClose();
    };
    const esc = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        anchor.current?.focus();
      }
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', esc, true);
    };
  }, [anchor, onClose]);

  return createPortal(<div ref={ref} className="popover" style={style}>{children}</div>, document.body);
}

/* Вибір зі списку: один або кілька варіантів, з пошуком для довгих списків */
export function Select({ label, hint, value, onChange, options, placeholder = 'Оберіть', multiple, disabled, clearable, compact }) {
  const id = useId();
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const close = useCallback(() => { setOpen(false); setQuery(''); }, []);

  const searchable = options.length > 6;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const selected = multiple ? value ?? [] : value;
  const isOn = (v) => (multiple ? selected.includes(v) : selected === v);
  const summary = multiple
    ? options.filter((o) => isOn(o.value)).map((o) => o.label).join(', ')
    : options.find((o) => o.value === value)?.label;

  const pick = (v) => {
    if (multiple) {
      onChange(isOn(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    } else {
      onChange(v);
      close();
      anchor.current?.focus();
    }
  };

  useEffect(() => {
    if (open) setActive(Math.max(0, shown.findIndex((o) => isOn(o.value))));
    // Активний рядок ставимо лише під час відкриття та пошуку.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);
  useEffect(() => {
    if (open) listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onKey = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && shown[active]) { e.preventDefault(); pick(shown[active].value); }
    else if (e.key === 'Tab') close();
  };

  return (
    <Field label={label} hint={hint} id={id}>
      <button ref={anchor} id={id} type="button" className={`input select-btn ${compact ? 'is-compact' : ''} ${open ? 'is-open' : ''}`} disabled={disabled}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))} onKeyDown={onKey}>
        <span className={summary ? 'select-value' : 'select-placeholder'}>{summary || placeholder}</span>
        <IconDown size={18} />
      </button>
      {open && (
        <Popover anchor={anchor} onClose={close} width={compact ? 240 : undefined}>
          {searchable && (
            <input autoFocus className="popover-search" placeholder="Пошук" aria-label="Пошук" value={query}
              onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} />
          )}
          <ul ref={listRef} className="options" role="listbox" aria-multiselectable={multiple || undefined}>
            {clearable && !multiple && (
              <li role="option" aria-selected={value == null} className="option option-clear" onClick={() => pick(null)}>{clearable}</li>
            )}
            {shown.map((o, i) => (
              <li key={o.value} role="option" aria-selected={isOn(o.value)}
                className={`option ${i === active ? 'is-active' : ''} ${isOn(o.value) ? 'is-selected' : ''}`}
                onMouseEnter={() => setActive(i)} onClick={() => pick(o.value)}>
                {o.icon && <span className="option-ico" aria-hidden="true">{o.icon}</span>}
                <span>
                  {o.label}
                  {o.hint && <small>{o.hint}</small>}
                </span>
                {isOn(o.value) && <IconTick size={16} />}
              </li>
            ))}
            {!shown.length && <li className="option-empty">Нічого не знайдено</li>}
          </ul>
        </Popover>
      )}
    </Field>
  );
}

/* Календар */
export function DatePicker({ label, hint, value, onChange, min, placeholder = 'Оберіть дату', clearable }) {
  const id = useId();
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Field label={label} hint={hint} id={id}>
      <div className="input-group">
        <button ref={anchor} id={id} type="button" className={`input select-btn ${open ? 'is-open' : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className={value ? 'select-value' : 'select-placeholder'}>{value ? shortDate(value) : placeholder}</span>
          <IconCalendar size={18} />
        </button>
        {clearable && value && <IconButton label="Очистити дату" onClick={() => onChange('')}><IconClose size={18} /></IconButton>}
      </div>
      {open && (
        <Popover anchor={anchor} onClose={close} width={292}>
          <Calendar value={value} min={min} onPick={(d) => { onChange(d); close(); anchor.current?.focus(); }} />
        </Popover>
      )}
    </Field>
  );
}

function Calendar({ value, min, onPick }) {
  const today = todayISO();
  const [focus, setFocus] = useState(value || (min && min > today ? min : today));
  const gridRef = useRef(null);
  const moved = useRef(false);
  const f = parseDate(focus);
  const first = toISO(new Date(f.getFullYear(), f.getMonth(), 1));
  const start = addDays(first, 1 - weekdayOf(first));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));

  useEffect(() => {
    if (moved.current) gridRef.current?.querySelector('[tabindex="0"]')?.focus();
  }, [focus]);
  useEffect(() => {
    gridRef.current?.querySelector('[tabindex="0"]')?.focus();
  }, []);

  const shiftMonth = (n) => {
    const d = new Date(f.getFullYear(), f.getMonth() + n, 1);
    moved.current = false;
    setFocus(toISO(d));
  };
  const onKey = (e) => {
    const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (map[e.key]) {
      e.preventDefault();
      moved.current = true;
      setFocus(addDays(focus, map[e.key]));
    }
  };
  return (
    <div className="calendar">
      <div className="calendar-head">
        <IconButton label="Попередній місяць" onClick={() => shiftMonth(-1)}><IconLeft size={18} /></IconButton>
        <strong>{MONTHS[f.getMonth()]} {f.getFullYear()}</strong>
        <IconButton label="Наступний місяць" onClick={() => shiftMonth(1)}><IconRight size={18} /></IconButton>
      </div>
      <div className="calendar-grid" ref={gridRef} onKeyDown={onKey}>
        {WEEKDAYS.map((w) => <span key={w} className="calendar-dow">{w}</span>)}
        {days.map((d) => {
          const outside = parseDate(d).getMonth() !== f.getMonth();
          return (
            <button key={d} type="button" tabIndex={d === focus ? 0 : -1} disabled={Boolean(min && d < min)}
              className={`${outside ? 'is-outside' : ''} ${d === value ? 'is-selected' : ''} ${d === today ? 'is-today' : ''}`}
              aria-pressed={d === value} onClick={() => onPick(d)}>
              {parseDate(d).getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Час: окремі колонки годин і хвилин */
export function TimePicker({ label, hint, value, onChange }) {
  const id = useId();
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [h, m] = (value || '').split(':');
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
  const hoursRef = useRef(null);
  useEffect(() => {
    if (open) setTimeout(() => hoursRef.current?.querySelector('.is-selected')?.scrollIntoView({ block: 'center' }), 0);
  }, [open]);
  return (
    <Field label={label} hint={hint} id={id}>
      <button ref={anchor} id={id} type="button" className={`input select-btn ${open ? 'is-open' : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={value ? 'select-value' : 'select-placeholder'}>{value || 'Оберіть час'}</span>
        <IconClock size={18} />
      </button>
      {open && (
        <Popover anchor={anchor} onClose={close} width={190}>
          <div className="timepick">
            <div className="timepick-col" ref={hoursRef} role="listbox" aria-label="Години">
              {hours.map((x) => (
                <button key={x} type="button" className={x === h ? 'is-selected' : ''} onClick={() => onChange(`${x}:${m ?? '00'}`)}>{x}</button>
              ))}
            </div>
            <div className="timepick-col" role="listbox" aria-label="Хвилини">
              {mins.map((x) => (
                <button key={x} type="button" className={x === m ? 'is-selected' : ''} onClick={() => { onChange(`${h ?? '12'}:${x}`); close(); anchor.current?.focus(); }}>{x}</button>
              ))}
            </div>
          </div>
        </Popover>
      )}
    </Field>
  );
}

/* Модальне вікно або бічна панель */
export function Modal({ title, onClose, children, side, narrow, badge }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const before = document.activeElement;
    const focusable = () => ref.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea, a[href], [tabindex="0"]') ?? [];
    const firstField = ref.current?.querySelector('.modal-body input, .modal-body textarea, .modal-body button') ?? ref.current;
    firstField?.focus();
    const key = (e) => {
      // Клавіші обробляє лише верхнє вікно, якщо відкрито кілька.
      const stack = document.querySelectorAll('.modal-backdrop');
      if (stack[stack.length - 1] !== ref.current?.parentElement) return;
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab') {
        const items = [...focusable()];
        if (!items.length || !ref.current?.contains(document.activeElement)) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', key);
      if (!document.querySelector('.modal-backdrop')) document.body.classList.remove('no-scroll');
      before?.focus?.();
    };
  }, []);

  return createPortal(
    <div className={`modal-backdrop ${side ? 'is-side' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal ${narrow ? 'is-narrow' : ''} ${badge ? 'has-badge' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        {badge && <div className="modal-badge">{badge}</div>}
        <header className="modal-head">
          <h2>{title}</h2>
          <IconButton label="Закрити" onClick={onClose}><IconClose /></IconButton>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* Дрібні елементи */
export const Status = ({ kind, children }) => <span className={`status status-${kind}`}>{children}</span>;
/** Позначка «Із запізненням»: роботу чи тест здали після дедлайну. */
export const LateTag = () => <span className="late-tag">Із запізненням</span>;

export function Empty({ icon, title, action }) {
  return (
    <div className="empty">
      {icon}
      <p>{title}</p>
      {action}
    </div>
  );
}

/**
 * Шапка розділу (Розклад, Курси, Люди…): назва лише для скрінрідерів, а фільтри й кнопки — в панелі,
 * що на телефоні зафіксована внизу над меню, а з десктопа стоїть угорі сторінки.
 * На телефоні фільтри сховані за кнопкою-іконкою: шторка, зміни застосовуються одразу, без «OK».
 * filtered — чи відрізняється вибір від типового: тоді на кнопці крапка.
 * Висоту панелі віддає в --dock-h, щоб сторінка й сповіщення не ховались під нею.
 */
export function PageTools({ title, filters, filtered = false, children }) {
  const dock = useRef(null);
  const mobile = useIsMobile();
  const [sheet, setSheet] = useState(false);
  const has = Boolean(filters || children);
  useLayoutEffect(() => {
    const el = dock.current;
    if (!el) return undefined;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--dock-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty('--dock-h'); };
  }, [has]);
  return (
    <header className="page-tools">
      <h1 className="sr">{title}</h1>
      {has && (
        <div className="page-dock" ref={dock}>
          {filters && (mobile ? (
            <button type="button" className={`dock-filter ${filtered ? 'is-on' : ''}`} aria-label="Фільтри" title="Фільтри" aria-haspopup="dialog" onClick={() => setSheet(true)}>
              <IconFilters size={20} />
            </button>
          ) : <div className="dock-filters">{filters}</div>)}
          {children && <div className="dock-actions">{children}</div>}
        </div>
      )}
      {sheet && mobile && filters && (
        <Modal title="Фільтри" onClose={() => setSheet(false)}>
          <div className="filter-sheet">{filters}</div>
        </Modal>
      )}
    </header>
  );
}

export function PageHead({ title, children }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

/**
 * Текст, у якому посилання клікабельні. Лише http(s) і www: javascript: та інші схеми лишаються текстом.
 * Розділові знаки в кінці не входять у посилання.
 */
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}])/gi;

/** Перше посилання в тексті як готова адреса, або null. */
export function firstUrl(text) {
  const found = String(text ?? '').match(new RegExp(URL_RE.source, 'i'));
  if (!found) return null;
  return /^https?:\/\//i.test(found[0]) ? found[0] : `https://${found[0]}`;
}
export function Linkify({ text }) {
  if (!text) return null;
  const parts = String(text).split(URL_RE);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const href = /^https?:\/\//i.test(part) ? part : `https://${part}`;
    return <a key={i} className="text-link" href={href} target="_blank" rel="noopener noreferrer">{part}</a>;
  });
}

export function Loader() {
  return <div className="loader" role="status" aria-label="Завантаження"><span /></div>;
}

export function ErrorNote({ text, onRetry }) {
  return (
    <div className="empty">
      <p>{text}</p>
      {onRetry && <Button variant="ghost" onClick={onRetry}>Спробувати ще раз</Button>}
    </div>
  );
}
