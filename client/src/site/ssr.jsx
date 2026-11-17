/*
 * Рендер сайту в HTML під час збірки (scripts/prerender.mjs), не в браузері.
 * Ті самі компоненти, що й у браузері, лише StaticRouter замість BrowserRouter:
 * пошуковики й ШІ-боти отримують увесь текст сторінки без виконання JavaScript.
 */
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { SeoSinkCtx } from './ctx.js';
import { SiteApp } from './Site.jsx';

export * from './seo.js';

/** HTML сторінки за адресою url і її мета (title, description, JSON-LD), яку сторінка віддала через useSeo. */
export function render(url, boot) {
  const sink = { meta: null };
  const html = renderToString(
    <SeoSinkCtx.Provider value={sink}>
      <SiteApp boot={boot} Router={StaticRouter} routerProps={{ location: url }} />
    </SeoSinkCtx.Provider>
  );
  return { html, meta: sink.meta };
}
