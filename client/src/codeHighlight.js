/*
 * Код у тестах: ШІ обгортає його в ^^…^^, тут він розбивається на шматки й підсвічується, як у VS Code.
 * Модуль без React: його перевіряють юніт-тести.
 */

/** Розбиває текст на звичайні шматки й код: [{ code: false, text }, { code: true, text }]. */
export function splitCode(text) {
  const parts = [];
  const re = /\^\^([\s\S]+?)\^\^/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ code: false, text: text.slice(last, m.index) });
    parts.push({ code: true, text: dedent(m[1]) });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ code: false, text: text.slice(last) });
  return parts;
}

/** Прибирає порожні рядки по краях і спільний відступ, як редактор при вставці. */
export function dedent(code) {
  const lines = code.replace(/\t/g, '  ').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(Number.isFinite(pad) ? pad : 0).replace(/\s+$/, '')).join('\n');
}

const CONTROL = new Set('if else elif for while do return break continue switch case default try catch finally except raise throw await yield import export from as with in of pass match'.split(' '));
const KEYWORD = new Set(('const let var function def class new this self super typeof instanceof void delete true false null undefined None True False lambda async static public private protected '
  + 'readonly abstract interface type enum extends implements int float double char bool boolean string number long short byte unsigned signed struct namespace using package fn func go defer echo and or not is').split(' '));

/*
 * Токени по черзі: коментар, рядок, тег HTML, число, слово, решта символів. Слово далі уточнюється:
 * ключове, керування, виклик функції (далі «(»), тип (з великої літери), змінна.
 */
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|(?:^|(?<=\s))#(?=\s)[^\n]*|<!--[\s\S]*?-->)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(<\/?[A-Za-z][\w-]*|\/?>)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+|[^\sA-Za-z_$\d"'`<]+|[<"'`])/gm;

/** Підсвічує код: масив [клас, текст]. Класи hl-* фарбує CSS у палітрі VS Code. */
export function highlight(code) {
  const out = [];
  let inTag = false;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(code))) {
    const [all, comment, str, tag, num, word] = m;
    if (comment) out.push(['hl-comment', all]);
    else if (str) out.push([inTag ? 'hl-attr-value' : 'hl-string', all]);
    else if (tag) {
      if (tag.endsWith('>')) { inTag = false; out.push(['hl-punct', all]); }
      else { inTag = true; const slash = tag.startsWith('</') ? 2 : 1; out.push(['hl-punct', tag.slice(0, slash)], ['hl-tag', tag.slice(slash)]); }
    } else if (num) out.push(['hl-number', all]);
    else if (word) {
      const next = code.slice(TOKEN.lastIndex).match(/^\s*(\S)/)?.[1];
      if (inTag) out.push(['hl-attr', all]);
      else if (CONTROL.has(word)) out.push(['hl-control', all]);
      else if (KEYWORD.has(word)) out.push(['hl-keyword', all]);
      else if (next === '(') out.push(['hl-function', all]);
      else if (/^[A-Z]/.test(word)) out.push(['hl-type', all]);
      else out.push(['hl-variable', all]);
    } else out.push(['hl-plain', all]);
    if (!all) TOKEN.lastIndex += 1;
  }
  // Сусідні шматки одного класу зливаються: менше елементів у DOM.
  return out.reduce((acc, [cls, text]) => {
    const prev = acc[acc.length - 1];
    if (prev && prev[0] === cls) prev[1] += text;
    else acc.push([cls, text]);
    return acc;
  }, []);
}
