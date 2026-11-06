import { useRef, useState } from 'react';
import { api } from '../api.js';
import { Button, IconButton, Modal, Segmented, Textarea, useAction, useUI } from '../ui.jsx';
import { IconClose, IconFile, IconPlus, IconSpark, IconTrash } from '../icons.jsx';

const MAX_TEXT = 30000;
const MAX_FILE = 1024 * 1024;

/** Текст → чернетка від Gemini → правки людини → запис у роадмап. */
export default function RoadmapAi({ course, onClose, onDone }) {
  const [text, setText] = useState('');
  const [draft, setDraft] = useState(null);
  const [placement, setPlacement] = useState('append');
  const [run, busy] = useAction();
  const { confirm, toast } = useUI();
  const fileInput = useRef(null);
  const hasSteps = course.steps.length > 0;

  const generate = async (e) => {
    e?.preventDefault();
    const result = await run(() => api(`/courses/${course.id}/roadmap/draft`, { method: 'POST', body: { text } }));
    if (result) setDraft(result.steps);
  };

  const loadFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE) {
      toast('Файл завеликий: максимум 1 МБ тексту', 'error');
      return;
    }
    setText((await file.text()).slice(0, MAX_TEXT));
  };

  const patchStep = (i, patch) => setDraft(draft.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const removeStep = (i) => setDraft(draft.filter((_, k) => k !== i));
  const patchSub = (i, j, title) => patchStep(i, { substeps: draft[i].substeps.map((x, k) => (k === j ? title : x)) });
  const removeSub = (i, j) => patchStep(i, { substeps: draft[i].substeps.filter((_, k) => k !== j) });
  const addSub = (i) => patchStep(i, { substeps: [...draft[i].substeps, ''] });
  const addStep = () => setDraft([...draft, { title: '', description: null, substeps: [] }]);

  const save = async (e) => {
    e.preventDefault();
    const replace = hasSteps && placement === 'replace';
    if (replace) {
      const yes = await confirm({ title: 'Замінити весь роадмап?', text: 'Поточні етапи й позначки учнів на них зникнуть.', action: 'Замінити', danger: true });
      if (!yes) return;
    }
    const ok = await run(() => api(`/courses/${course.id}/roadmap/import`, { method: 'POST', body: { steps: draft, replace } }), 'Роадмап оновлено');
    if (ok) onDone();
  };

  if (!draft) {
    return (
      <Modal title="Роадмап зі ШІ" onClose={onClose}>
        <form className="form" onSubmit={generate}>
          <Textarea label="Текст програми" rows={10} autoFocus maxLength={MAX_TEXT} required value={text}
            placeholder="Вставте програму курсу, план або конспект" onChange={(e) => setText(e.target.value)} />
          <div className="ai-source-tools">
            <Button variant="ghost" small icon={<IconFile size={16} />} onClick={() => fileInput.current?.click()}>Файл .txt або .md</Button>
            <input ref={fileInput} type="file" accept=".txt,.md,text/plain,text/markdown" tabIndex={-1} aria-label="Текстовий файл" onChange={loadFile} />
            <span className="ai-note">{text.length} із {MAX_TEXT}</span>
          </div>
          <p className="ai-note">Текст обробляє Google Gemini. Не вставляйте особисті дані учнів.</p>
          {busy && (
            <div className="ai-thinking" role="status"><IconSpark size={22} /> Gemini складає етапи. Це може тривати до хвилини.</div>
          )}
          <div className="form-actions">
            <Button variant="ghost" onClick={onClose}>Назад</Button>
            <Button type="submit" busy={busy} disabled={!text.trim()} icon={<IconSpark size={18} />}>Розкласти</Button>
          </div>
        </form>
      </Modal>
    );
  }

  const valid = draft.length > 0 && draft.every((s) => s.title.trim());
  return (
    <Modal title="Перевірте чернетку" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <ol className="ai-draft">
          {draft.map((step, i) => (
            <li key={i}>
              <div className="ai-step">
                <span className="step-num">{i + 1}</span>
                <input className="input" aria-label={`Назва етапу ${i + 1}`} maxLength={120} value={step.title} onChange={(e) => patchStep(i, { title: e.target.value })} />
                <IconButton label={`Прибрати етап ${i + 1}`} onClick={() => removeStep(i)}><IconTrash size={18} /></IconButton>
              </div>
              {step.description && <p className="ai-step-desc">{step.description}</p>}
              <div className="ai-subs">
                {step.substeps.map((sub, j) => (
                  <div key={j} className="ai-sub">
                    <input className="input" aria-label={`Підпункт ${j + 1} етапу ${i + 1}`} maxLength={160} value={sub} onChange={(e) => patchSub(i, j, e.target.value)} />
                    <IconButton label={`Прибрати підпункт ${j + 1} етапу ${i + 1}`} onClick={() => removeSub(i, j)}><IconClose size={16} /></IconButton>
                  </div>
                ))}
                <Button variant="ghost" small className="ai-sub-add" icon={<IconPlus size={15} />} onClick={() => addSub(i)}>Підпункт</Button>
              </div>
            </li>
          ))}
        </ol>
        <div className="ai-more">
          <Button variant="ghost" small icon={<IconPlus size={16} />} onClick={addStep}>Додати етап</Button>
          <Button variant="ghost" small busy={busy} icon={<IconSpark size={16} />} onClick={() => generate()}>Розкласти ще раз</Button>
        </div>
        {hasSteps && (
          <Segmented label="Куди додати" value={placement} onChange={setPlacement} options={[
            { value: 'append', label: 'У кінець' },
            { value: 'replace', label: 'Замінити все' },
          ]} />
        )}
        <div className="form-actions">
          <Button variant="ghost" onClick={() => setDraft(null)}>До тексту</Button>
          <Button type="submit" busy={busy} disabled={!valid}>Додати в роадмап</Button>
        </div>
      </form>
    </Modal>
  );
}
