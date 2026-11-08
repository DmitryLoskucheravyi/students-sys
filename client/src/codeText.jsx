import { highlight, splitCode } from './codeHighlight.js';

function Code({ code }) {
  return highlight(code).map(([cls, text], i) => <span key={i} className={cls}>{text}</span>);
}

/**
 * Текст питання чи варіанта з кодом у ^^…^^.
 * question: багаторядковий код — блоком на темному тлі, короткий — плашкою; answer: лише кольори, без тла.
 */
export function CodeText({ text, kind = 'answer' }) {
  const parts = splitCode(text ?? '');
  if (parts.length === 1 && !parts[0].code) return text;
  return parts.map((p, i) => {
    if (!p.code) return <span key={i}>{p.text}</span>;
    if (kind === 'question' && p.text.includes('\n')) {
      return <pre key={i} className="code-block"><code><Code code={p.text} /></code></pre>;
    }
    return <code key={i} className={kind === 'question' ? 'code-inline' : 'code-text'}><Code code={p.text} /></code>;
  });
}
