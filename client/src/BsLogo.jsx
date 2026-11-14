import { useLayoutEffect, useRef } from 'react';

/**
 * Логотип Be Smart School, що збирається при появі: BS, букви виїжджають, BE встає вертикально,
 * School виїжджає з-під Smart. Анімацію й розміри задає .bs-logo у styles.css; className додає варіант.
 *
 * Розміри вертикального BE в CSS заміряні для Unbounded. Якщо браузер шрифт не завантажив
 * (блокувальник, режим блокування в iOS), «BE» має іншу ширину й з'їжджає. Тож міряємо його
 * в шрифті, який реально стоїть, і підставляємо --be-w та --be-s.
 */
const BE_LENGTH = 1.88; // довжина вертикального BE у em: висота двох рядків Smart + School

export default function BsLogo({ className = '' }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let alive = true;
    const fit = () => {
      if (!alive) return;
      const probe = document.createElement('span');
      probe.textContent = 'BE';
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit';
      el.appendChild(probe);
      const size = parseFloat(getComputedStyle(el).fontSize);
      const w = probe.getBoundingClientRect().width / size;
      probe.remove();
      if (!w || !Number.isFinite(w)) return;
      el.style.setProperty('--be-w', `${w.toFixed(3)}em`);
      el.style.setProperty('--be-s', (BE_LENGTH / w).toFixed(3));
    };
    fit();
    document.fonts?.ready.then(fit);
    return () => { alive = false; };
  }, []);
  return (
    <p ref={ref} className={`bs-logo ${className}`} role="img" aria-label="Be Smart School">
      <span className="bs-be" aria-hidden="true">
        <span className="bs-word bs-be-in"><b>B</b><span className="bs-tail"><span>E</span></span></span>
      </span>
      <span className="bs-stack" aria-hidden="true">
        <span className="bs-word"><b>S</b><span className="bs-tail"><span>mart</span></span></span>
        <span className="bs-under"><span>School</span></span>
      </span>
    </p>
  );
}
