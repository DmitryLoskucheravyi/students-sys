/* Прогрес учня на курсі: чисті функції. */

/** Частка пройденого етапу: підпункти рахуються по одному, етап без підпунктів — цілим. */
export const stepShare = (s, doneIds, doneSubs) => {
  if (doneIds.has(s.id)) return 1;
  if (!s.substeps.length) return 0;
  return s.substeps.filter((x) => doneSubs.has(x.id)).length / s.substeps.length;
};

/** Стан домашнього для учня; без учня (вчитель ще не обрав) стану немає. */
export const hwState = (h, viewerId) => (viewerId ? h.results.find((r) => r.student_id === viewerId)?.status ?? 'todo' : null);
