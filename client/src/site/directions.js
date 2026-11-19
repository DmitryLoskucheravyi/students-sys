/*
 * Напрямки сайту — у коді, не в кабінеті: картка, чипи й програма задані тут.
 * Форма та сама, що колись приходила з API (seo.js, сторінка курсу, пререндер працюють із нею без змін):
 * { id, slug, title, summary, courses: [{ id, title, steps: [{ id, title, description, topics }] }], steps }.
 * Новий напрямок — новий обʼєкт у SITE_DIRECTIONS (і, за потреби, своя ілюстрація в DirectionArt).
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

export const SITE_DIRECTIONS = [
  {
    id: 'frontend',
    slug: 'frontend',
    title: 'Frontend з нуля',
    titleMain: 'Frontend',
    titleAccent: 'з нуля',
    summary: 'Вчимося створювати сайти: HTML, CSS, JavaScript і сучасний фронтенд!',
    chips: ['HTML', 'CSS', 'JavaScript', 'Сайт'],
    art: 'frontend',
    icon: 'web',
    theme: null,
    steps: FRONTEND_STEPS.length,
    courses: [{ id: 'frontend', title: 'Frontend з нуля', steps: FRONTEND_STEPS }],
  },
  {
    id: 'frontend-pro',
    slug: 'frontend-pro',
    title: 'Frontend PRO',
    titleMain: 'Frontend',
    titleAccent: 'PRO',
    badge: 'Поглиблений курс',
    summary: 'Пишемо сучасні застосунки на React, TypeScript і Next.js — так, як працюють у реальних командах.',
    features: [['React', 'компоненти, хуки, стан'], ['TypeScript', 'типи без болю й помилок'], ['Next.js', 'роутинг, SSR, деплой']],
    art: 'pro',
    look: 'dark', // темна картка, ілюстрація ліворуч
    icon: 'web',
    theme: null,
    steps: PRO_STEPS.length,
    courses: [{ id: 'frontend-pro', title: 'Frontend PRO', steps: PRO_STEPS }],
  },
  {
    id: 'python',
    slug: 'python',
    title: 'Python з нуля',
    titleMain: 'Python',
    titleAccent: 'з нуля',
    badge: 'Новий напрям',
    badgeNote: '.py',
    wrap: ['>>> print(', ')'], // заголовок «обгорнутий» у виклик print
    summary: 'Перша справжня мова програмування: від першого рядка коду до власних ігор і програм.',
    codeLine: ['теми', ['змінні', 'цикли', 'функції', 'ігри']],
    art: 'python',
    look: 'py', // фіолетова картка з рядками Python-коду на тлі, жовтий акцент
    icon: 'py',
    theme: null,
    steps: PY_STEPS.length,
    courses: [{ id: 'python', title: 'Python з нуля', steps: PY_STEPS }],
  },
  {
    id: 'backend',
    slug: 'backend',
    title: 'Backend',
    titleMain: 'Backend',
    badge: 'Новий напрям',
    summary: 'Те, що працює «під капотом» сайтів і застосунків: сервер, API, дані та код, який легко розвивати.',
    features: [['Сервер', 'API, запити, авторизація', 'server'], ['Бази даних', 'SQL, таблиці, звʼязки', 'db'], ['ООП', 'класи, обʼєкти, спадкування', 'oop']],
    art: 'backend',
    look: 'light', // світла персикова картка в клітинку
    icon: 'db',
    theme: null,
    steps: BE_STEPS.length,
    courses: [{ id: 'backend', title: 'Backend', steps: BE_STEPS }],
  },
  {
    id: 'ai',
    slug: 'ai',
    title: 'ШІ з нуля',
    titleMain: 'ШІ',
    titleAccent: 'з нуля',
    badge: 'Новий напрям',
    summary: 'Знайомимося зі штучним інтелектом і вчимося створювати фото та відео за текстовим описом.',
    features: [['Як працює ШІ', 'промпти й чат-боти', 'idea'], ['Фото з тексту', 'ілюстрації, постери', 'image'], ['Відео з тексту', 'короткі ролики', 'video']],
    art: 'ai',
    look: 'light',
    bg: 'dots', // бузкове тло в крапку
    artLeft: true,
    icon: 'ai',
    theme: null,
    steps: AI_STEPS.length,
    courses: [{ id: 'ai', title: 'ШІ з нуля', steps: AI_STEPS }],
  },
  {
    id: 'pc',
    slug: 'kompiuterna-hramotnist',
    title: 'Комп’ютерна грамотність',
    kicker: 'Комп’ютер — це просто!',
    titleMain: 'Комп’ютерна',
    titleAccent: 'грамотність',
    badge: 'Для дітей',
    badgePlain: true, // стриманий, не яскравий
    summary: 'Знайомимося з комп’ютером крок за кроком, у грі та без стресу.',
    features: [['Друкуємо наосліп', '', 'keyboard'], ['Файли й папки', '', 'folder'], ['Безпечний інтернет', '', 'shield']],
    art: 'pc',
    look: 'light',
    bg: 'keys', // кремове тло з клавішами-декором
    icon: 'blocks',
    theme: null,
    steps: PC_STEPS.length,
    courses: [{ id: 'pc', title: 'Комп’ютерна грамотність', steps: PC_STEPS }],
  },
  {
    id: 'scratch',
    slug: 'scratch',
    title: 'Scratch: програмуємо граючись',
    titleMain: 'Scratch',
    badge: 'Програмуємо граючись',
    badgePlain: true, // білий бейдж з обводкою
    summary: 'Складаємо програми з кольорових блоків, як конструктор, і створюємо власні ігри та мультики.',
    features: [['Блоки й алгоритми', '', 'blocks'], ['Свої ігри', '', 'gamepad'], ['Мультики й анімація', '', 'film']],
    art: 'scratch',
    look: 'light',
    bg: 'play', // кремове тло з бузковим колом і кольоровими фігурами
    artLeft: true,
    icon: 'blocks',
    theme: null,
    steps: SCRATCH_STEPS.length,
    courses: [{ id: 'scratch', title: 'Scratch: програмуємо граючись', steps: SCRATCH_STEPS }],
  },
];
