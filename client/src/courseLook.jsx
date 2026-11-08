import { IconRoadmap, IconSpark } from './icons.jsx';

/*
 * Вигляд курсу: іконка й колірна тема. Набори мають збігатися з COURSE_ICONS і COURSE_THEMES
 * у server/modules/courses/courses.service.ts. Іконки власні й узагальнені: монограми та прості знаки, без логотипів.
 */
const S = ({ size = 22, children }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const A = (p) => <path className="ia" {...p} />;
/** Монограма в заокругленому квадраті: TS, JS, Py. */
const Mono = ({ size, text }) => (
  <S size={size}>
    <rect x="3" y="3.500" width="18" height="17" rx="4" />
    <text x="12" y="15.600" textAnchor="middle" fontSize="7.900" fontWeight="800" fill="currentColor" stroke="none"
      style={{ fontFamily: 'var(--display)', letterSpacing: '-0.05em' }}>{text}</text>
  </S>
);
/** Літера C для C# і C++: дуга, а не текст, щоб поруч помістились знаки. */
const C_ARC = 'M9.900 8.700a3.600 3.600 0 1 0 0 6.600';

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
  { id: 'git', label: 'Git', render: (s) => <S size={s}><circle cx="6.500" cy="5.500" r="2.200" /><circle cx="6.500" cy="18.500" r="2.200" /><circle cx="17.500" cy="8" r="2.200" /><path d="M6.500 7.700v8.600" /><A d="M17.500 10.200c0 4-4.500 4-8.800 6.800" /></S> },
  { id: 'php', label: 'PHP', render: (s) => <S size={s}><ellipse cx="12" cy="12" rx="10" ry="7" /><text x="12" y="14.300" textAnchor="middle" fontSize="7" fontWeight="800" fill="currentColor" stroke="none" style={{ fontFamily: 'var(--display)', letterSpacing: '-0.04em' }}>php</text></S> },
  { id: 'sql', label: 'MySQL і SQL', render: (s) => <S size={s}><rect x="3.500" y="4.500" width="17" height="15" rx="2.500" /><A d="M5 9.500h14M9.500 11v7M11 14.500h8" /></S> },
  { id: 'next', label: 'Next.js', render: (s) => <S size={s}><circle cx="12" cy="12" r="9" /><path d="M9 16.500v-9l7.200 9.800" /><A d="M15.500 7.500v5" /></S> },
  { id: 'react', label: 'React', render: (s) => <S size={s}><ellipse cx="12" cy="12" rx="9.500" ry="3.600" /><ellipse cx="12" cy="12" rx="9.500" ry="3.600" transform="rotate(60 12 12)" /><ellipse className="ia" cx="12" cy="12" rx="9.500" ry="3.600" transform="rotate(-60 12 12)" /><circle cx="12" cy="12" r="1.400" fill="currentColor" stroke="none" /></S> },
  { id: 'node', label: 'Node.js', render: (s) => <S size={s}><path d="M12 2.500l8.300 4.800v9.400L12 21.500l-8.300-4.800V7.300z" /><A d="M9 9.500v4.800a1.700 1.700 0 0 1-3 1M12.500 14.500c.4.900 1.300 1.300 2.300 1.300 1.200 0 2.100-.6 2.100-1.600 0-2.300-4.300-1.200-4.300-3.500 0-.9.800-1.500 2-1.500.9 0 1.700.4 2 1.100" /></S> },
  { id: 'java', label: 'Java', render: (s) => <S size={s}><path d="M5 10.500h11.500v4.500a4.500 4.500 0 0 1-4.500 4.500H9.500A4.500 4.500 0 0 1 5 15z" /><path d="M16.500 12h1.200a2.300 2.300 0 0 1 0 4.600h-1.500M3.500 21.500h15" /><A d="M8.500 7.500c-.8-1.200.8-2 0-3.500M12 7.500c-.8-1.200.8-2 0-3.500" /></S> },
  { id: 'cs', label: 'C#', render: (s) => <S size={s}><rect x="3" y="3.500" width="18" height="17" rx="4" /><path d={C_ARC} /><A d="M12.500 10.500h6M12.500 13.700h6M14.600 8.600l-.6 6.800M17.400 8.600l-.6 6.800" strokeWidth="1.600" /></S> },
  { id: 'cpp', label: 'C++', render: (s) => <S size={s}><rect x="3" y="3.500" width="18" height="17" rx="4" /><path d={C_ARC} /><A d="M11.700 12h2.400M12.900 10.800v2.400M16.300 12h2.400M17.500 10.800v2.400" strokeWidth="1.600" /></S> },
  { id: 'css', label: 'CSS і стилі', render: (s) => <S size={s}><path d="M8.500 4c-2 0-2.600 1-2.600 2.600v2.400c0 1.300-.8 2.100-2.100 2.300 1.300.2 2.100 1 2.100 2.300v2.400c0 1.600.6 2.600 2.600 2.600M15.500 4c2 0 2.600 1 2.600 2.600v2.400c0 1.300.8 2.100 2.100 2.300-1.300.2-2.100 1-2.100 2.300v2.400c0 1.600-.6 2.600-2.600 2.600" /><A d="M12 9.300h.01M12 14l-.8 2.300" strokeWidth="2.600" /></S> },
  { id: 'docker', label: 'Контейнери', render: (s) => <S size={s}><path d="M12 2.800l8 4.500v9.400l-8 4.500-8-4.500V7.300z" /><A d="M4 7.300l8 4.500 8-4.500M12 11.800v9.400" /></S> },
  { id: 'cloud', label: 'Хмара', render: (s) => <S size={s}><path d="M7 18.500a4.500 4.500 0 0 1-.5-9 6 6 0 0 1 11.500 1.500 3.800 3.800 0 0 1-.5 7.500z" /><A d="M12 16v-5M9.800 13l2.200-2.200 2.200 2.200" /></S> },
  { id: 'api', label: 'API', render: (s) => <S size={s}><path d="M4 8.500h14.500M20 15.500H5.500" /><A d="M15 5l3.500 3.500L15 12M9 12l-3.500 3.500L9 19" /></S> },
  { id: 'security', label: 'Безпека', render: (s) => <S size={s}><path d="M12 2.800l7.500 3v5.700c0 4.800-3.200 8.200-7.500 9.700-4.300-1.500-7.500-4.900-7.500-9.700V5.800z" /><A d="M8.800 12l2.200 2.300 4.300-4.600" /></S> },
  { id: 'data', label: 'Аналітика', render: (s) => <S size={s}><path d="M3.500 20.500h17" /><A d="M6.500 17v-4M11 17V7.500M15.500 17v-6.500M20 17V4.500" /></S> },
  { id: 'design', label: 'Дизайн', render: (s) => <S size={s}><path d="M4 20l1.200-4.400L15.500 5.300a2.100 2.100 0 0 1 3 3L8.200 18.600z" /><A d="M13.500 7.300l3 3M4 20h16" /></S> },
];

export const COURSE_THEMES = [
  { id: 'school', name: 'Шкільна', hint: 'Червона, як уся школа' },
  { id: 'typed', name: 'Типізована', hint: 'Синя: TypeScript, C#, Java' },
  { id: 'script', name: 'Скриптова', hint: 'Жовта: JavaScript, Node.js' },
  { id: 'snake', name: 'Зміїна', hint: 'Синьо-жовта: Python, дані' },
  { id: 'web', name: 'Вебова', hint: 'Помаранчева: HTML, CSS, верстка' },
  { id: 'git', name: 'Гілкова', hint: 'Вогняно-помаранчева з графітом: Git, DevOps' },
  { id: 'php', name: 'Бузкова', hint: 'Фіолетова: PHP, Laravel, бекенд' },
  { id: 'sql', name: 'Таблична', hint: 'Синьо-бірюзова з помаранчевим: MySQL, SQL' },
  { id: 'next', name: 'Монохромна', hint: 'Чорно-біла: Next.js, React' },
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
