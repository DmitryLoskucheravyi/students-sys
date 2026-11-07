import { initials } from './fmt.js';

/*
 * Аватарки: лише з цього набору, свої картинки не завантажуються.
 * Персонажі власні, у дусі мемів, але без копій відомих зображень.
 * Набір id має збігатися з AVATARS у server/avatars.js.
 */
const Y = '#ffd25a';    // жовте обличчя
const INK = '#2a1d1f';
const face = (fill = Y) => <circle cx="32" cy="34" r="20" fill={fill} />;

const DRAW = {
  cool: (
    <>
      {face()}
      <path d="M13 26h38v4h-3v6h-12v-4h-4v4h-12v-6h-7z" fill={INK} />
      <path d="M19 31h3v2h-3zM40 31h3v2h-3z" fill="#fff" />
      <path d="M25 44c5 3 11 2 15-3" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </>
  ),
  skeptic: (
    <>
      {face()}
      <path d="M18 27h9" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M37 24l9-4" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="23" cy="32" r="2.6" fill={INK} />
      <circle cx="42" cy="31" r="3.2" fill={INK} />
      <path d="M25 45l14-3" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  lol: (
    <>
      {face()}
      <path d="M17 31q4-6 9 0M38 31q4-6 9 0" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M21 38h22q0 13-11 13t-11-13z" fill="#7a1f2b" />
      <path d="M26 47q6-4 12 0q-6 5-12 0z" fill="#ff7b8a" />
      <path d="M12 32q-4 7 0 9q4-2 0-9zM52 32q-4 7 0 9q4-2 0-9z" fill="#4cc9f0" />
    </>
  ),
  shock: (
    <>
      {face()}
      <circle cx="24" cy="30" r="6" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <circle cx="40" cy="30" r="6" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <circle cx="24" cy="30" r="1.8" fill={INK} />
      <circle cx="40" cy="30" r="1.8" fill={INK} />
      <ellipse cx="32" cy="45" rx="4.5" ry="6" fill="#7a1f2b" />
      <path d="M50 18q-4 6 0 8q4-2 0-8z" fill="#4cc9f0" />
    </>
  ),
  galaxy: (
    <>
      <path d="M14 34c-2-9 5-15 11-14c2-5 12-5 14 0c7-1 12 6 10 13c3 5-1 12-7 12c-3 5-12 6-15 1c-7 2-14-4-13-12z" fill="#ff8fc8" />
      <path d="M24 24c2 4-1 7 2 10M33 21c-2 5 3 7 0 12M41 26c-3 3 1 7-2 10M22 38c4-1 6 2 10 0M35 40c3-2 6 0 8-2" stroke="#b5179e" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M10 14l1.5 3.5 3.5 1.5-3.5 1.5L10 24l-1.5-3.5L5 19l3.5-1.5zM53 10l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1zM52 48l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="#ffe066" />
    </>
  ),
  coffee: (
    <>
      <path d="M24 9q-3 4 0 7t0 7M32 7q-3 4 0 7t0 7M40 9q-3 4 0 7t0 7" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.85" />
      <path d="M44 33h4a6 6 0 0 1 0 12h-4" stroke="#fff" strokeWidth="4" fill="none" />
      <path d="M15 27h30v19a8 8 0 0 1-8 8H23a8 8 0 0 1-8-8z" fill="#fff" />
      <path d="M21 36h7M33 36h7" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M21 39q3 2 6 0M34 39q3 2 6 0" stroke="#9b8fd6" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M27 47h7" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  bug: (
    <>
      <path d="M26 14q-3-5-7-5M38 14q3-5 7-5" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M14 33h-5M50 33h5M15 42l-5 3M49 42l5 3M16 25l-5-3M48 25l5-3" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="32" cy="36" rx="17" ry="19" fill="#e63946" />
      <path d="M32 17v38" stroke={INK} strokeWidth="2" />
      <circle cx="24" cy="40" r="3" fill={INK} /><circle cx="40" cy="40" r="3" fill={INK} /><circle cx="25" cy="49" r="2" fill={INK} /><circle cx="39" cy="49" r="2" fill={INK} />
      <circle cx="32" cy="20" r="9" fill={INK} />
      <circle cx="28.5" cy="19" r="3.4" fill="#fff" /><circle cx="35.5" cy="19" r="3.4" fill="#fff" />
      <circle cx="29.5" cy="20" r="1.5" fill={INK} /><circle cx="34.5" cy="18" r="1.5" fill={INK} />
    </>
  ),
  duck: (
    <>
      <ellipse cx="34" cy="44" rx="20" ry="12" fill="#ffd60a" />
      <path d="M48 38q8-6 6 4q-4 2-8 0z" fill="#ffd60a" />
      <circle cx="26" cy="27" r="12" fill="#ffd60a" />
      <path d="M14 27q-8 1-8 4q4 3 9 1z" fill="#fb8500" />
      <circle cx="23" cy="24" r="2.4" fill={INK} /><circle cx="23.8" cy="23.2" r="0.8" fill="#fff" />
      <path d="M28 44q6 5 14 0" stroke="#e0b100" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  bot: (
    <>
      <path d="M32 10v7" stroke="#495057" strokeWidth="2.4" /><circle cx="32" cy="9" r="3" fill="#e63946" />
      <rect x="13" y="17" width="38" height="32" rx="9" fill="#e9ecef" />
      <rect x="18" y="22" width="28" height="16" rx="5" fill="#212529" />
      <path d="M22 32l3-4 3 4M36 32l3-4 3 4" stroke="#4cc9f0" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 43h16" stroke="#adb5bd" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 3" />
      <rect x="9" y="28" width="4" height="10" rx="2" fill="#adb5bd" /><rect x="51" y="28" width="4" height="10" rx="2" fill="#adb5bd" />
    </>
  ),
  ghost: (
    <>
      <path d="M14 54V31a18 18 0 0 1 36 0v23l-6-4-6 4-6-4-6 4-6-4z" fill="#fff" />
      <ellipse cx="25" cy="30" rx="3" ry="4.5" fill={INK} /><ellipse cx="39" cy="30" rx="3" ry="4.5" fill={INK} />
      <path d="M26 39h12q0 5-6 5t-6-5z" fill={INK} />
      <path d="M30 42h6v4a3 3 0 0 1-6 0z" fill="#ff7b8a" />
    </>
  ),
  alien: (
    <>
      <path d="M32 10c12 0 19 9 19 19c0 13-11 25-19 25S13 42 13 29c0-10 7-19 19-19z" fill="#80ed99" />
      <path d="M17 30c2-6 9-6 11 2c-1 5-9 5-11-2zM47 30c-2-6-9-6-11 2c1 5 9 5 11-2z" fill="#1b263b" />
      <circle cx="21" cy="30" r="1.4" fill="#fff" /><circle cx="43" cy="30" r="1.4" fill="#fff" />
      <path d="M29 45q3 2 6 0" stroke="#1b263b" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  cat: (
    <>
      <path d="M13 26L15 9l12 10zM51 26L49 9 37 19z" fill="#9aa5b1" />
      <path d="M16 22l1-8 6 5zM48 22l-1-8-6 5z" fill="#ffafcc" />
      <ellipse cx="32" cy="36" rx="21" ry="18" fill="#9aa5b1" />
      <circle cx="23" cy="33" r="5" fill="#fff" /><circle cx="42" cy="33" r="3.4" fill="#fff" />
      <circle cx="24" cy="34" r="2.6" fill={INK} /><circle cx="41.5" cy="32.5" r="1.6" fill={INK} />
      <path d="M30 40l2 2 2-2" fill="#ff8fab" />
      <path d="M26 44q3 3 6 0q3 3 6 0" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M8 38l10 1M8 43l10-1M56 38l-10 1M56 43l-10-1" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  potato: (
    <>
      <path d="M14 30c0-12 10-19 21-18s17 9 16 21s-8 21-20 21s-17-12-17-24z" fill="#c8915a" />
      <circle cx="20" cy="22" r="1.4" fill="#9c6a3c" /><circle cx="45" cy="45" r="1.6" fill="#9c6a3c" /><circle cx="22" cy="46" r="1.2" fill="#9c6a3c" />
      <circle cx="25" cy="31" r="6" fill="none" stroke={INK} strokeWidth="2.2" /><circle cx="40" cy="31" r="6" fill="none" stroke={INK} strokeWidth="2.2" />
      <path d="M31 31h3" stroke={INK} strokeWidth="2.2" />
      <circle cx="25" cy="31" r="2" fill={INK} /><circle cx="40" cy="31" r="2" fill={INK} />
      <path d="M27 42q5 4 10 0" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </>
  ),
  avocado: (
    <>
      <path d="M32 8c10 0 14 12 18 22c4 12-4 25-18 25S10 42 14 30C18 20 22 8 32 8z" fill="#386641" />
      <path d="M32 13c7 0 10 10 13 18c3 10-3 20-13 20s-16-10-13-20c3-8 6-18 13-18z" fill="#c7e59a" />
      <circle cx="32" cy="38" r="8" fill="#9c6644" />
      <circle cx="26" cy="26" r="2" fill={INK} /><circle cx="38" cy="26" r="2" fill={INK} />
      <path d="M29 30q3 2.5 6 0" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="22" cy="30" r="2" fill="#ff8fab" opacity="0.7" /><circle cx="42" cy="30" r="2" fill="#ff8fab" opacity="0.7" />
    </>
  ),
  loading: (
    <>
      {face('#fff')}
      <circle cx="32" cy="34" r="25" fill="none" stroke="#4cc9f0" strokeWidth="4" strokeDasharray="30 127" strokeLinecap="round" transform="rotate(-60 32 34)" />
      <circle cx="25" cy="31" r="2.4" fill={INK} /><circle cx="39" cy="31" r="2.4" fill={INK} />
      <circle cx="26" cy="43" r="1.6" fill={INK} /><circle cx="32" cy="43" r="1.6" fill={INK} /><circle cx="38" cy="43" r="1.6" fill={INK} />
    </>
  ),
  nerd: (
    <>
      {face()}
      <path d="M14 22q18-10 36 0q-4-9-18-9t-18 9z" fill="#5c3d2e" />
      <circle cx="24" cy="32" r="7" fill="#fff" stroke={INK} strokeWidth="2.6" /><circle cx="40" cy="32" r="7" fill="#fff" stroke={INK} strokeWidth="2.6" />
      <path d="M31 32h2" stroke={INK} strokeWidth="2.6" />
      <circle cx="25" cy="33" r="2.4" fill={INK} /><circle cx="41" cy="33" r="2.4" fill={INK} />
      <path d="M24 43q8 6 16 0z" fill="#7a1f2b" />
      <rect x="29" y="43" width="6" height="5" rx="1" fill="#fff" />
    </>
  ),
  sleepy: (
    <>
      {face()}
      <path d="M18 32q5 4 10 0M36 32q5 4 10 0" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <ellipse cx="32" cy="44" rx="4" ry="3" fill="#7a1f2b" />
      <path d="M36 45q2 5 0 7q-2-2 0-7z" fill="#4cc9f0" />
      <text x="44" y="18" fill="#fff" fontSize="11" fontWeight="800" fontFamily="sans-serif">Z</text>
      <text x="52" y="11" fill="#fff" fontSize="7" fontWeight="800" fontFamily="sans-serif">z</text>
    </>
  ),
  fire: (
    <>
      <path d="M32 6c3 10 16 14 16 30a16 16 0 0 1-32 0c0-8 4-12 7-16c1 5 3 7 5 7c-1-8 1-15 4-21z" fill="#ff6d00" />
      <path d="M32 26c2 6 9 8 9 16a9 9 0 0 1-18 0c0-5 3-7 5-10c1 3 2 4 3 4c0-4 0-7 1-10z" fill="#ffd60a" />
      <path d="M23 38h18v3h-2v3h-6v-3h-2v3h-6v-3h-2z" fill={INK} />
      <path d="M28 49q4 2 8-1" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  dino: (
    <>
      <path d="M10 50c0-14 4-30 22-30h8c8 0 14 5 14 12c0 6-4 9-10 9H30c-4 0-6 3-6 9z" fill="#70e000" />
      <path d="M30 41h14c4 0 8-2 9-5" stroke="#38b000" strokeWidth="2" fill="none" />
      <path d="M33 41l2 3 2-3 2 3 2-3" fill="#fff" />
      <circle cx="42" cy="28" r="3.6" fill="#fff" /><circle cx="43" cy="28" r="1.8" fill={INK} />
      <path d="M16 26l-4-3 5-1zM20 21l-2-5 5 2zM26 18l1-5 3 4z" fill="#38b000" />
      <circle cx="50" cy="31" r="1" fill={INK} />
    </>
  ),
  e404: (
    <>
      <text x="32" y="25" textAnchor="middle" fill="#e63946" fontSize="17" fontWeight="900" fontFamily="ui-monospace, Consolas, monospace" letterSpacing="-1">404</text>
      <circle cx="32" cy="42" r="12" fill={Y} />
      <path d="M26 39l3 3M29 39l-3 3M35 39l3 3M38 39l-3 3" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M27 49q5-4 10 0" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
};

export const AVATARS = [
  { id: 'cool', label: 'Крутий', bg: '#3a3a5a' },
  { id: 'skeptic', label: 'Скептик', bg: '#8ecae6' },
  { id: 'lol', label: 'Ржака', bg: '#ffb703' },
  { id: 'shock', label: 'Шок', bg: '#ff8fab' },
  { id: 'galaxy', label: 'Галактичний мозок', bg: '#2d0a5c' },
  { id: 'coffee', label: 'Ще кави', bg: '#b07d62' },
  { id: 'bug', label: 'Це фіча', bg: '#a7c957' },
  { id: 'duck', label: 'Дебаг-качка', bg: '#48cae4' },
  { id: 'bot', label: 'Бот', bg: '#6c757d' },
  { id: 'ghost', label: 'Бу!', bg: '#6d597a' },
  { id: 'alien', label: 'Прибулець', bg: '#1b263b' },
  { id: 'cat', label: 'Котик', bg: '#ffd6e7' },
  { id: 'potato', label: 'Розумна картопля', bg: '#e9d8c4' },
  { id: 'avocado', label: 'Авокадо', bg: '#d8f3dc' },
  { id: 'loading', label: 'Завантажуюсь…', bg: '#0b3d91' },
  { id: 'nerd', label: 'Ботан', bg: '#a2d2ff' },
  { id: 'sleepy', label: 'Сплю', bg: '#3d405b' },
  { id: 'fire', label: 'На вогні', bg: '#3c0919' },
  { id: 'dino', label: 'Динозавр', bg: '#caf0f8' },
  { id: 'e404', label: 'Мозок не знайдено', bg: '#f1faee' },
];

const byId = Object.fromEntries(AVATARS.map((a) => [a.id, a]));

/** Малюнок аватарки в колі. */
export function AvatarArt({ id, size = 36, title }) {
  const a = byId[id];
  if (!a) return null;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'}>
      <circle cx="32" cy="32" r="32" fill={a.bg} />
      {DRAW[id]}
    </svg>
  );
}

/** Аватарка користувача: обрана картинка або ініціали. */
export function Avatar({ user, size = 36, className = '' }) {
  if (user?.avatar && byId[user.avatar]) {
    return <span className={`avatar has-art ${className}`} style={{ width: size, height: size }}><AvatarArt id={user.avatar} size={size} /></span>;
  }
  return <span className={`avatar ${className}`} style={{ width: size, height: size }}>{initials(user?.name)}</span>;
}

/** Вибір аватарки з набору. value null: без аватарки, ініціали. */
export function AvatarPicker({ value, onChange, name }) {
  return (
    <div className="avatar-pick" role="radiogroup" aria-label="Аватарка">
      <button type="button" role="radio" aria-checked={!value} aria-label="Без аватарки" title="Без аватарки"
        className={`avatar-opt ${!value ? 'is-on' : ''}`} onClick={() => onChange(null)}>
        <span className="avatar avatar-red avatar-none">{initials(name) || '—'}</span>
      </button>
      {AVATARS.map((a) => (
        <button key={a.id} type="button" role="radio" aria-checked={value === a.id} aria-label={a.label} title={a.label}
          className={`avatar-opt ${value === a.id ? 'is-on' : ''}`} onClick={() => onChange(a.id)}>
          <AvatarArt id={a.id} size={48} />
        </button>
      ))}
    </div>
  );
}
