/**
 * Логотип Be Smart School, що збирається при появі: BS, букви виїжджають, BE встає вертикально,
 * School виїжджає з-під Smart. Анімацію й розміри задає .bs-logo у styles.css; className додає варіант.
 */
export default function BsLogo({ className = '' }) {
  return (
    <p className={`bs-logo ${className}`} role="img" aria-label="Be Smart School">
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
