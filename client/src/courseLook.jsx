import { IconRoadmap, IconSpark } from './icons.jsx';

/*
 * Вигляд курсу: іконка й колірна тема. Набори мають збігатися з COURSE_ICONS і COURSE_THEMES
 * у server/routes/courses.js. Іконки власні й узагальнені: монограми та прості знаки, без логотипів.
 */
const S = ({ size = 22, children }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const A = (p) => <path className="ia" {...p} />;
/** Монограма в заокругленому квадраті: TS, JS, Py. */
const Mono = ({ size, text }) => (
  <S size={size}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <text x="12" y="16.200" textAnchor="middle" fontSize="8.800" fontWeight="800" fill="currentColor" stroke="none"
      style={{ fontFamily: 'var(--display)', letterSpacing: '-0.04em' }}>{text}</text>
  </S>
);

export const COURSE_ICONS = [
  { id: 'roadmap', label: 'Роадмап', render: (s) => <IconRoadmap size={s} /> },
  { id: 'code', label: 'Код', render: (s) => <S size={s}><path d="M8.500 7L3.500 12l5 5M15.500 7l5 5-5 5" /><A d="M13.500 4.500l-3 15" /></S> },
  { id: 'ts', label: 'TypeScript', render: (s) => <Mono size={s} text="TS" /> },
  { id: 'js', label: 'JavaScript', render: (s) => <Mono size={s} text="JS" /> },
  { id: 'py', label: 'Python', render: (s) => <Mono size={s} text="Py" /> },
  { id: 'web', label: 'Веб', render: (s) => <S size={s}><circle cx="12" cy="12" r="8.500" /><A d="M3.500 12h17M12 3.500c2.500 2.500 3.500 5.300 3.500 8.500s-1 6-3.500 8.500c-2.500-2.500-3.500-5.300-3.500-8.500s1-6 3.500-8.500z" /></S> },
  { id: 'blocks', label: 'Компоненти', render: (s) => <S size={s}><rect x="3.500" y="3.500" width="7" height="7" rx="1.500" /><rect x="13.500" y="13.500" width="7" height="7" rx="1.500" /><rect x="3.500" y="13.500" width="7" height="7" rx="1.500" /><A d="M17 3.500l3.500 3.500-3.500 3.500-3.500-3.500z" /></S> },
  { id: 'terminal', label: 'Термінал', render: (s) => <S size={s}><rect x="3" y="4.500" width="18" height="15" rx="2" /><A d="M7 9.500l3 2.500-3 2.500M12.500 15H17" /></S> },
  { id: 'db', label: 'Бази даних', render: (s) => <S size={s}><ellipse cx="12" cy="6" rx="7" ry="2.800" /><path d="M5 6v12c0 1.500 3.100 2.800 7 2.800s7-1.300 7-2.800V6" /><A d="M5 12c0 1.500 3.100 2.800 7 2.800s7-1.300 7-2.800" /></S> },
  { id: 'mobile', label: 'Мобільні', render: (s) => <S size={s}><rect x="6.500" y="2.500" width="11" height="19" rx="2.500" /><A d="M10.500 18.500h3" /></S> },
  { id: 'game', label: 'Ігри', render: (s) => <S size={s}><path d="M7.500 7.500h9a4.500 4.500 0 0 1 4.300 5.800l-1 3.300a2.300 2.300 0 0 1-3.900.9L14 15.500h-4l-1.900 2a2.300 2.300 0 0 1-3.900-.9l-1-3.300A4.500 4.500 0 0 1 7.500 7.500z" /><A d="M8 10.500v3M6.500 12h3M15.500 11h.01M17 13h.01" /></S> },
  { id: 'ai', label: 'ШІ', render: (s) => <IconSpark size={s} /> },
  { id: 'design', label: 'Дизайн', render: (s) => <S size={s}><path d="M4 20l1.200-4.400L15.500 5.300a2.100 2.100 0 0 1 3 3L8.200 18.600z" /><A d="M13.500 7.300l3 3M4 20h16" /></S> },
];

export const COURSE_THEMES = [
  { id: 'school', name: 'Шкільна', hint: 'Червона, як уся школа' },
  { id: 'typed', name: 'Типізована', hint: 'Синя: TypeScript, C#, Java' },
  { id: 'script', name: 'Скриптова', hint: 'Жовта: JavaScript, Node.js' },
  { id: 'snake', name: 'Зміїна', hint: 'Синьо-жовта: Python, дані' },
  { id: 'web', name: 'Вебова', hint: 'Помаранчева: HTML, CSS, верстка' },
];

/** Клас теми для обгортки: перевизначає акцентні кольори всередині. */
export const themeClass = (theme) => `ct ct-${theme || 'school'}`;

/** Іконка курсу на кольоровій плашці теми. */
export function CourseIcon({ course, size = 24, big }) {
  const icon = COURSE_ICONS.find((i) => i.id === course?.icon) ?? COURSE_ICONS[0];
  return <span className={`course-ico ${themeClass(course?.theme)} ${big ? 'is-big' : ''}`} aria-hidden="true">{icon.render(size)}</span>;
}

/** Вибір іконки й теми у формі курсу, з живим попереднім переглядом. */
export function CourseLookPicker({ title, icon, theme, onIcon, onTheme }) {
  return (
    <div className="look">
      <div className={`look-preview ${themeClass(theme)}`}>
        <CourseIcon course={{ icon, theme }} size={26} big />
        <div>
          <strong>{title || 'Назва курсу'}</strong>
          <span className="progress"><i style={{ width: '45%' }} /></span>
        </div>
      </div>
      <fieldset className="look-set">
        <legend>Іконка</legend>
        <div className="look-icons" role="radiogroup" aria-label="Іконка курсу">
          {COURSE_ICONS.map((i) => (
            <button key={i.id} type="button" role="radio" aria-checked={(icon || 'roadmap') === i.id} aria-label={i.label} title={i.label}
              className={`look-icon ${(icon || 'roadmap') === i.id ? 'is-on' : ''}`} onClick={() => onIcon(i.id)}>
              {i.render(22)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="look-set">
        <legend>Тема</legend>
        <div className="look-themes" role="radiogroup" aria-label="Тема курсу">
          {COURSE_THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={(theme || 'school') === t.id}
              className={`look-theme ${themeClass(t.id)} ${(theme || 'school') === t.id ? 'is-on' : ''}`} onClick={() => onTheme(t.id)}>
              <span className="look-swatch" aria-hidden="true"><i /><i /><i /></span>
              <span><strong>{t.name}</strong><small>{t.hint}</small></span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
