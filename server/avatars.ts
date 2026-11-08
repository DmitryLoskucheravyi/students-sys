import { bad } from './lib.js';

/* Аватарки лише з готового набору: малюнки живуть у client/src/avatars.jsx, тут їхні id. */
export const AVATARS = [
  'cool', 'skeptic', 'lol', 'shock', 'galaxy', 'coffee', 'bug', 'duck', 'bot', 'ghost',
  'alien', 'cat', 'potato', 'avocado', 'loading', 'nerd', 'sleepy', 'fire', 'dino', 'e404',
];

/** undefined: поле не передали; null чи порожньо: прибрати аватарку. */
export function parseAvatar(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || !AVATARS.includes(v)) throw bad('Такої аватарки немає');
  return v;
}
