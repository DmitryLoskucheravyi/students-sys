/* Спільне для сайту: дані (курси, ціни, відгуки, контакти) і відкриття форми заявки. */
import { createContext, useContext } from 'react';

export const SiteCtx = createContext({ data: null, error: null, reload: () => {} });
export const useSite = () => useContext(SiteCtx);

export const LeadCtx = createContext(() => {});
/** Відкрити форму заявки; note — підказка в поле «Додатково» (наприклад, обраний курс). */
export const useLead = () => useContext(LeadCtx);

/** Телефон для посилання tel: лише цифри й плюс. */
export const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;
/** +380671234567 → +380 67 123 45 67 */
export function prettyPhone(phone) {
  const m = String(phone).match(/^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+380 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}
