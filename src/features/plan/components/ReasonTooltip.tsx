import { useId, useState, type ReactNode } from 'react';

import styles from './ReasonTooltip.module.css';

export function ReasonTooltip({
  ariaLabel,
  children,
  content,
  triggerClassName = '',
}: {
  ariaLabel: string;
  children: ReactNode;
  content: ReactNode;
  triggerClassName?: string | undefined;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className={styles.wrap}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`${styles.trigger} ${triggerClassName}`}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen((current) => !current)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setIsOpen(false);
          }
        }}
        type="button"
      >
        {children}
      </button>
      {isOpen ? (
        <span className={styles.tooltip} id={tooltipId} role="tooltip">
          {content}
        </span>
      ) : null}
    </span>
  );
}

export function ReasonTooltipList({ lines }: { lines: string[] }) {
  const visibleLines = lines.filter(Boolean).slice(0, 4);

  if (visibleLines.length === 0) {
    return null;
  }

  return visibleLines.length === 1 ? (
    <span>{visibleLines[0]}</span>
  ) : (
    <ul className={styles.list}>
      {visibleLines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
