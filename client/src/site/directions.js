/*
 * Напрямки сайту — у коді, не в кабінеті: картка, чипи й програма задані тут.
 * Форма та сама, що колись приходила з API (seo.js, сторінка курсу, пререндер працюють із нею без змін):
 * { id, slug, title, summary, courses: [{ id, title, steps: [{ id, title, description, topics }] }], steps }.
 * Картка (course-card.jsx) бере звідси: ages, level, titleMain/titleAccent, summary (опис від «ти», про результат),
 * path (3 кроки: два — що вивчиш, третій — результат), look (кольори картки), art (ілюстрація), face (маскот), isNew.
 * Порядок — за віком, від молодших до старших. Новий напрямок — новий обʼєкт тут і, за потреби, своя сцена в course-art.jsx.
 */

const FRONTEND_STEPS = [
  { id: 'html', title: 'HTML', description: 'Як влаштована вебсторінка: з чого вона складається і як браузер її показує.',
    topics: ['Теги, заголовки й абзаци', 'Посилання й картинки', 'Списки й таблиці', 'Форми й кнопки'] },
  { id: 'css', title: 'CSS', description: 'Робимо сторінку гарною: кольори, шрифти, відступи й розкладка.',
    topics: ['Кольори й шрифти', 'Блокова модель', 'Flexbox і Grid', 'Адаптивність під телефон'] },
  { id: 'js', title: 'JavaScript', description: 'Оживляємо сайт: кнопки, анімації, ігри й робота з даними.',
    topics: ['Змінні й умови', 'Цикли й функції', 'DOM і події', 'Робота з даними'] },
  { id: 'site', title: 'Свій сайт', description: 'Власний проєкт від макета до публікації в інтернеті.',
    topics: ['Макет і структура', 'Верстка й стилі', 'Інтерактив на JavaScript', 'Публікація в інтернеті'] },
];

const PRO_STEPS = [
  { id: 'react', title: 'React', description: 'Компонентний підхід, на якому будують сучасні інтерфейси.',
    topics: ['Компоненти й пропси', 'Хуки', 'Стан і події', 'Списки й форми'] },
  { id: 'ts', title: 'TypeScript', description: 'Типи, які ловлять помилки ще до запуску.',
    topics: ['Типи й інтерфейси', 'Типізація компонентів', 'Узагальнення (generics)', 'Типи даних з API'] },
  { id: 'next', title: 'Next.js', description: 'Повноцінний застосунок: сторінки, дані й публікація.',
    topics: ['Роутинг', 'Серверний рендер (SSR)', 'Дані й API', 'Деплой'] },
  { id: 'team', title: 'Командний проєкт', description: 'Як у реальних командах: задачі, код-рев’ю й реліз.',
    topics: ['Git і пул-реквести', 'Код-рев’ю', 'Спільний проєкт', 'Реліз застосунку'] },
];

const PY_STEPS = [
  { id: 'basics', title: 'Основи', description: 'Перший рядок коду: як Python думає і що вміє.',
    topics: ['print і змінні', 'Числа й рядки', 'Введення з клавіатури', 'Помилки й як їх читати'] },
  { id: 'loops', title: 'Умови й цикли', description: 'Програма, яка вирішує й повторює сама.',
    topics: ['if, elif, else', 'Цикли for і while', 'Списки', 'Маленькі задачі-головоломки'] },
  { id: 'funcs', title: 'Функції', description: 'Свої команди: пишемо раз, використовуємо скрізь.',
    topics: ['Свої функції', 'Параметри й return', 'Модулі й random', 'Словники'] },
  { id: 'games', title: 'Свої ігри', description: 'Від текстових ігор до власного проєкту.',
    topics: ['Вгадай число', 'Текстовий квест', 'Гра з графікою', 'Свій проєкт'] },
];

const BE_STEPS = [
  { id: 'server', title: 'Сервер і API', description: 'Що відбувається, коли сайт щось просить у сервера.',
    topics: ['Запити й відповіді', 'Маршрути API', 'JSON', 'Авторизація'] },
  { id: 'db', title: 'Бази даних', description: 'Де живуть дані і як їх знайти за мить.',
    topics: ['Таблиці й звʼязки', 'SQL-запити', 'Фільтри й сортування', 'Дані з коду'] },
  { id: 'oop', title: 'ООП', description: 'Код, який легко читати й розвивати.',
    topics: ['Класи й обʼєкти', 'Інкапсуляція', 'Спадкування', 'Свої моделі даних'] },
  { id: 'project', title: 'Свій бекенд', description: 'Сервер для власного застосунку від і до.',
    topics: ['Проєктуємо API', 'База для проєкту', 'Тести', 'Запуск в інтернеті'] },
];

const AI_STEPS = [
  { id: 'how', title: 'Як працює ШІ', description: 'Що всередині нейромереж і як із ними говорити.',
    topics: ['Що таке ШІ і нейромережі', 'Чат-боти', 'Промпти, які працюють', 'Безпека й чесність'] },
  { id: 'img', title: 'Фото з тексту', description: 'Генеруємо зображення за описом.',
    topics: ['Опис сцени', 'Стилі й композиція', 'Ілюстрації й постери', 'Доопрацювання результату'] },
  { id: 'video', title: 'Відео з тексту', description: 'Короткі ролики від ідеї до готового відео.',
    topics: ['Сценарій', 'Генерація відео', 'Монтаж і звук', 'Свій ролик'] },
  { id: 'project', title: 'Свій проєкт', description: 'Поєднуємо все: власна історія, картинки й відео.',
    topics: ['Ідея й план', 'Персонажі', 'Готовий проєкт', 'Презентація'] },
];

const PC_STEPS = [
  { id: 'start', title: 'Знайомство з комп’ютером', description: 'З чого складається комп’ютер і як із ним дружити.',
    topics: ['Мишка й клавіатура', 'Вікна й робочий стіл', 'Програми', 'Порядок на комп’ютері'] },
  { id: 'type', title: 'Друкуємо наосліп', description: 'Швидко й без підглядання — у грі.',
    topics: ['Домашній ряд', 'Усі літери', 'Цифри й знаки', 'Швидкість без помилок'] },
  { id: 'files', title: 'Файли й папки', description: 'Де що лежить і як не загубити свою роботу.',
    topics: ['Файли й папки', 'Збереження й пошук', 'Текст і малюнки', 'Флешка й хмара'] },
  { id: 'safe', title: 'Безпечний інтернет', description: 'Як шукати, перевіряти й не потрапити в халепу.',
    topics: ['Пошук у мережі', 'Паролі', 'Шахраї й фейки', 'Правила спілкування'] },
];

const SCRATCH_STEPS = [
  { id: 'blocks', title: 'Блоки й алгоритми', description: 'Складаємо програму з кольорових блоків, як конструктор.',
    topics: ['Команди й послідовність', 'Повторення', 'Умови', 'Змінні'] },
  { id: 'games', title: 'Свої ігри', description: 'Персонажі, керування й рахунок.',
    topics: ['Рух і керування', 'Зіткнення', 'Рахунок і рівні', 'Своя гра'] },
  { id: 'cartoons', title: 'Мультики й анімація', description: 'Оживляємо історії: сцени, діалоги, звук.',
    topics: ['Костюми й анімація', 'Діалоги', 'Звуки й музика', 'Свій мультик'] },
  { id: 'project', title: 'Свій проєкт', description: 'Від ідеї до готової гри чи мультика.',
    topics: ['Ідея й план', 'Створення', 'Тестування', 'Показ друзям'] },
];

export const LEVELS = { start: 'Старт', next: 'Для продовження' };

/*
 * look: bg — тло картки, accent — колір курсу (чип віку, уточнення в назві, кнопка, посилання, результат),
 * ink — текст, muted — опис, onAccent — текст на акценті, dark — темна картка (дорослий рівень).
 * Пари текст/тло перевірені на контраст ≥ 4.5:1.
 */
export const SITE_DIRECTIONS = [
  {
    id: 'pc',
    slug: 'kompiuterna-hramotnist',
    title: 'Комп’ютерна грамотність',
    titleMain: 'Комп’ютерна',
    titleAccent: 'грамотність',
    ages: [6, 9],
    level: 'start',
    summary: 'Навчишся друкувати, зберігати свої малюнки й безпечно гуляти інтернетом — у грі.',
    path: [['keyboard', 'Друкую сам'], ['folder', 'Файли й папки'], ['shield-check', 'Безпечний інтернет']],
    cta: 'Записати дитину', // картку для 6–9 часто читають батьки
    look: { bg: '#E4EEFC', accent: '#1F5FC4', ink: '#13203B', muted: '#3A4763', onAccent: '#fff' },
    art: 'pc',
    face: 'happy',
    icon: 'blocks',
    steps: PC_STEPS.length,
    courses: [{ id: 'pc', title: 'Комп’ютерна грамотність', steps: PC_STEPS }],
  },
  {
    id: 'scratch',
    slug: 'scratch',
    title: 'Scratch: програмуємо граючись',
    titleMain: 'Scratch',
    ages: [7, 11],
    level: 'start',
    summary: 'Складай програму з кольорових блоків, як конструктор, — і твій герой оживе.',
    path: [['puzzle', 'Блоки й алгоритми'], ['clapperboard', 'Мультики'], ['gamepad-2', 'Своя гра']],
    look: { bg: '#FFF1C7', accent: '#7B3FD1', ink: '#2A1B3D', muted: '#54452F', onAccent: '#fff' },
    art: 'scratch',
    face: 'happy',
    icon: 'blocks',
    steps: SCRATCH_STEPS.length,
    courses: [{ id: 'scratch', title: 'Scratch: програмуємо граючись', steps: SCRATCH_STEPS }],
  },
  {
    id: 'ai',
    slug: 'ai',
    title: 'ШІ з нуля',
    titleMain: 'ШІ',
    titleAccent: 'з нуля',
    ages: [9, 14],
    level: 'start',
    summary: 'Розберешся, як «думає» штучний інтелект, і навчишся створювати картинки й відео за своїм описом.',
    path: [['lightbulb', 'Як працює ШІ'], ['image', 'Картинки з тексту'], ['clapperboard', 'Свій мультфільм']],
    look: { bg: '#FDE6EF', accent: '#B8336A', ink: '#2B1622', muted: '#4A3A44', onAccent: '#fff' },
    art: 'ai',
    face: 'happy',
    icon: 'ai',
    steps: AI_STEPS.length,
    courses: [{ id: 'ai', title: 'ШІ з нуля', steps: AI_STEPS }],
  },
  {
    id: 'python',
    slug: 'python',
    title: 'Python з нуля',
    titleMain: 'Python',
    titleAccent: 'з нуля',
    ages: [10, 15],
    level: 'start',
    summary: 'Перша справжня мова програмування: від свого першого рядка до своєї гри.',
    path: [['repeat', 'Змінні й цикли'], ['braces', 'Функції'], ['gamepad-2', 'Гра на Python']],
    look: { bg: '#2E2A8C', bg2: '#4B2A8C', accent: '#FFD43B', ink: '#FFFFFF', muted: '#DCD8F7', onAccent: '#1D1733', dark: true },
    art: 'python',
    face: 'calm',
    icon: 'py',
    steps: PY_STEPS.length,
    courses: [{ id: 'python', title: 'Python з нуля', steps: PY_STEPS }],
  },
  {
    id: 'frontend',
    slug: 'frontend',
    title: 'Frontend з нуля',
    titleMain: 'Frontend',
    titleAccent: 'з нуля',
    ages: [11, 16],
    level: 'start',
    summary: 'Зробиш свій перший сайт і скинеш друзям посилання на нього.',
    path: [['file-code', 'HTML і CSS'], ['mouse-pointer-click', 'JavaScript'], ['globe', 'Свій сайт']],
    look: { bg: '#EEE8FF', accent: '#2D2A6E', ink: '#17151E', muted: '#4B4663', onAccent: '#fff' },
    art: 'frontend',
    face: 'calm',
    icon: 'web',
    steps: FRONTEND_STEPS.length,
    courses: [{ id: 'frontend', title: 'Frontend з нуля', steps: FRONTEND_STEPS }],
  },
  {
    id: 'backend',
    slug: 'backend',
    title: 'Backend',
    titleMain: 'Backend',
    ages: [14, 18],
    level: 'next',
    summary: 'Те, що працює «під капотом»: напишеш сервер і базу даних для свого застосунку.',
    path: [['server', 'Сервер і API'], ['database', 'Бази даних'], ['plug', 'Свій API-сервіс']],
    look: { bg: '#E3F5EC', accent: '#0E7A4F', ink: '#0F261C', muted: '#37503F', onAccent: '#fff' },
    art: 'backend',
    face: 'calm',
    icon: 'db',
    steps: BE_STEPS.length,
    courses: [{ id: 'backend', title: 'Backend', steps: BE_STEPS }],
  },
  {
    id: 'frontend-pro',
    slug: 'frontend-pro',
    title: 'Frontend PRO',
    titleMain: 'Frontend',
    titleAccent: 'PRO',
    ages: [14, 18],
    level: 'next',
    note: 'Після Frontend з нуля або зі знанням JS',
    summary: 'Пишеш застосунки на React, TypeScript і Next.js — так, як у справжніх командах.',
    path: [['atom', 'React і Next.js'], ['shield-check', 'TypeScript'], ['briefcase', 'Проєкт у портфоліо']],
    look: { bg: '#15131D', accent: '#B9A6FF', ink: '#F5F0E9', muted: '#CBC5D8', onAccent: '#15131D', dark: true },
    art: 'pro',
    face: 'cool',
    icon: 'web',
    steps: PRO_STEPS.length,
    courses: [{ id: 'frontend-pro', title: 'Frontend PRO', steps: PRO_STEPS }],
  },
];

/** «6–9 років» */
export const agesLabel = ([a, b]) => `${a}–${b} років`;
/** Вікові фільтри над картками; курс підходить, якщо його вік перетинається з діапазоном. */
export const AGE_FILTERS = [
  { id: '', label: 'Всі' },
  { id: '6-9', label: '6–9', range: [6, 9] },
  { id: '10-13', label: '10–13', range: [10, 13] },
  { id: '14-18', label: '14–18', range: [14, 18] },
];
export const fitsAge = (d, f) => !f?.range || (d.ages[0] <= f.range[1] && d.ages[1] >= f.range[0]);
