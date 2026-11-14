/* Розпізнавання збою завантаження коду. Окремо від React, щоб тестувати без браузера. */

/** Чи це помилка завантаження шматка коду (застаріла версія після деплою). Чиста функція. */
export function isChunkError(error) {
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`;
  return /ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(text);
}
