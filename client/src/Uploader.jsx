import { useEffect, useRef, useState } from 'react';
import { zip } from 'fflate';
import { uploadForm } from './api.js';
import { Button, IconButton, Textarea, useUI } from './ui.jsx';
import { IconClose, IconFile, IconFolderZip, IconImage, IconUpload } from './icons.jsx';
import { fileSize } from './fmt.js';

const IMAGE = /\.(png|jpe?g|webp|gif)$/i;
const SKIP_DIRS = /(^|\/)(node_modules|\.git|\.venv|__pycache__|dist|build)(\/|$)/;
const MAX_FILE_MB = Number(import.meta.env.VITE_MAX_FILE_MB) || 10;
const MAX_FILE = MAX_FILE_MB * 1024 * 1024;
const SHRINK_FROM = 300 * 1024;
const MAX_SIDE = 2560;

const kindOf = (file) => {
  if (/\.zip$/i.test(file.name)) return 'archive';
  if (IMAGE.test(file.name)) return 'screenshot';
  return 'file';
};

/** Зменшує великий скрін до WebP. Якщо браузер не вміє або виграшу немає, лишає оригінал. */
async function shrinkScreenshot(file) {
  if (file.size < SHRINK_FROM || /\.gif$/i.test(file.name)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (blob?.type !== 'image/webp' || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
  } catch {
    return file;
  }
}

/** Пакує папку в ZIP просто в браузері, без службових каталогів. */
async function zipFolder(name, entries) {
  const tree = {};
  for (const { path, file } of entries) {
    if (SKIP_DIRS.test(path)) continue;
    tree[path] = new Uint8Array(await file.arrayBuffer());
  }
  if (!Object.keys(tree).length) throw new Error('Папка порожня');
  const bytes = await new Promise((resolve, reject) => {
    zip(tree, { level: 6 }, (err, out) => (err ? reject(err) : resolve(out)));
  });
  return new File([bytes], `${name}.zip`, { type: 'application/zip' });
}

/** Читає вкладені файли папки, перетягнутої в зону завантаження. */
async function readDropEntry(entry, prefix = '') {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    return [{ path: prefix + entry.name, file }];
  }
  const reader = entry.createReader();
  const children = [];
  // readEntries віддає порції: читаємо, доки не повернеться порожньо.
  for (;;) {
    const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
    if (!batch.length) break;
    children.push(...batch);
  }
  const nested = await Promise.all(children.map((c) => readDropEntry(c, `${prefix}${entry.name}/`)));
  return nested.flat();
}

export default function Uploader({ homeworkId, resubmit, canSendWithoutNew, onDone }) {
  const { toast } = useUI();
  const [items, setItems] = useState([]);
  const [comment, setComment] = useState('');
  const [hover, setHover] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [shrinking, setShrinking] = useState(false);
  const [progress, setProgress] = useState(null);
  const filesRef = useRef(null);
  const folderRef = useRef(null);
  const shotsRef = useRef(null);

  const addFiles = async (list, forcedKind) => {
    setShrinking(true);
    const next = [];
    for (const original of list) {
      const kind = forcedKind ?? kindOf(original);
      const file = kind === 'screenshot' ? await shrinkScreenshot(original) : original;
      if (file.size > MAX_FILE) {
        toast(`«${file.name}» більший за ${MAX_FILE_MB} МБ`, 'error');
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        kind,
        url: IMAGE.test(file.name) ? URL.createObjectURL(file) : null,
      });
    }
    setItems((cur) => [...cur, ...next]);
    setShrinking(false);
  };

  const addFolder = async (name, entries) => {
    setZipping(true);
    try {
      await addFiles([await zipFolder(name, entries)], 'archive');
    } catch (e) {
      toast(e.message || 'Не вдалося запакувати папку', 'error');
    } finally {
      setZipping(false);
    }
  };

  const onFolderInput = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    // Мобільні браузери часто не вміють обирати папку і віддають звичайні файли.
    if (!files[0].webkitRelativePath) {
      addFiles(files);
      return;
    }
    const root = files[0].webkitRelativePath.split('/')[0];
    addFolder(root, files.map((f) => ({ path: f.webkitRelativePath, file: f })));
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setHover(false);
    const entries = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
    const dirs = entries.filter((x) => x.isDirectory);
    addFiles([...e.dataTransfer.files].filter((f, i) => !entries[i]?.isDirectory));
    for (const dir of dirs) {
      const all = await readDropEntry(dir);
      const stripped = all.map(({ path, file }) => ({ path, file }));
      await addFolder(dir.name, stripped);
    }
  };

  // Скрін можна просто вставити: Ctrl+V будь-де на сторінці.
  useEffect(() => {
    const paste = (e) => {
      const images = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (!images.length) return;
      e.preventDefault();
      const named = images.map((f, i) => new File([f], f.name && f.name !== 'image.png' ? f.name : `screenshot-${Date.now()}-${i + 1}.png`, { type: f.type }));
      addFiles(named, 'screenshot');
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
    // addFiles використовує лише сталі сетери та toast
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = (id) => {
    setItems((cur) => {
      const it = cur.find((x) => x.id === id);
      if (it?.url) URL.revokeObjectURL(it.url);
      return cur.filter((x) => x.id !== id);
    });
  };

  const send = async () => {
    const form = new FormData();
    form.append('comment', comment);
    const field = { archive: 'archive', screenshot: 'screenshots', file: 'files' };
    for (const it of items) form.append(field[it.kind], it.file, it.file.name);
    setProgress(0);
    try {
      await uploadForm(`/homework/${homeworkId}/submission`, form, setProgress);
      toast('Роботу здано');
      items.forEach((i) => i.url && URL.revokeObjectURL(i.url));
      setItems([]);
      setComment('');
      onDone();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setProgress(null);
    }
  };

  const total = items.reduce((a, i) => a + i.file.size, 0);
  const busy = progress !== null || zipping || shrinking;

  return (
    <div className="uploader">
      <div className={`drop ${hover ? 'is-hover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}>
        <IconUpload size={30} />
        <p className="for-pointer"><strong>Перетягніть сюди файли або папку</strong></p>
        <p className="for-touch"><strong>Додайте файли, папку або скріни</strong></p>
        <p className="muted small">До {MAX_FILE_MB} МБ на файл</p>
        <div className="drop-buttons">
          <Button variant="ghost" small icon={<IconFile size={18} />} onClick={() => filesRef.current.click()}>Файли</Button>
          <Button variant="ghost" small icon={<IconFolderZip size={18} />} onClick={() => folderRef.current.click()}>Папка в ZIP</Button>
          <Button variant="ghost" small icon={<IconImage size={18} />} onClick={() => shotsRef.current.click()}>Скріни</Button>
        </div>
        <input ref={filesRef} type="file" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} />
        <input ref={folderRef} type="file" hidden webkitdirectory="" directory="" onChange={onFolderInput} />
        <input ref={shotsRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => { addFiles([...e.target.files], 'screenshot'); e.target.value = ''; }} />
      </div>

      {zipping && <p className="muted small" role="status">Пакую папку…</p>}
      {shrinking && !zipping && <p className="muted small" role="status">Стискаю файли…</p>}

      {items.length > 0 && (
        <ul className="queue">
          {items.map((it) => (
            <li key={it.id}>
              {it.url ? <img src={it.url} alt="" /> : it.kind === 'archive' ? <IconFolderZip /> : <IconFile />}
              <span className="file-name">{it.file.name}</span>
              <small>{fileSize(it.file.size)}</small>
              <IconButton label={`Прибрати ${it.file.name}`} disabled={busy} onClick={() => remove(it.id)}><IconClose size={18} /></IconButton>
            </li>
          ))}
        </ul>
      )}

      <Textarea label="Коментар" rows={2} maxLength={3000} value={comment} onChange={(e) => setComment(e.target.value)} />

      {progress !== null && (
        <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Завантаження">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <div className="form-actions">
        {items.length > 0 && <span className="small muted">{fileSize(total)}</span>}
        <Button icon={<IconUpload size={18} />} busy={busy} disabled={!items.length && !canSendWithoutNew} onClick={send}>
          {resubmit ? 'Здати знову' : 'Здати роботу'}
        </Button>
      </div>
    </div>
  );
}
