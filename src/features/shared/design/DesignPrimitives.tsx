import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { closeOnBackdropMouseDown, useEscapeToClose } from './dialogDismiss';
import overlayStyles from './DesignOverlays.module.css';
import styles from './DesignPrimitives.module.css';

type ButtonTone = 'danger' | 'primary' | 'secondary';
type ActionIntent = 'danger' | 'neutral' | 'success' | 'warning';
type ActionPriority = 'ghost' | 'primary' | 'secondary';

export function Panel({
  children,
  padded = true,
}: {
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={`${styles.panel} ${padded ? styles.panelPadding : ''}`}>
      {children}
    </section>
  );
}

export function RouteHeader({
  actions,
  kicker,
  summary,
  title,
}: {
  actions?: ReactNode;
  kicker?: string;
  summary?: ReactNode;
  title: string;
}) {
  return (
    <header className={styles.routeHeader}>
      <div>
        {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
        <h1>{title}</h1>
        {summary ? <p className={styles.routeSummary}>{summary}</p> : null}
      </div>
      {actions ? <div className={styles.routeActions}>{actions}</div> : null}
    </header>
  );
}

export function Banner({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <aside
      className={`${styles.banner} ${
        tone === 'warning' ? styles.bannerWarning : ''
      }`}
    >
      {children}
    </aside>
  );
}

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'danger' | 'neutral' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? styles.badgeSuccess
      : tone === 'warning'
        ? styles.badgeWarning
        : tone === 'danger'
          ? styles.badgeDanger
          : '';

  return (
    <span className={`${styles.badge} ${toneClass}`} data-ui="status">
      {children}
    </span>
  );
}

export function InfoChip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? styles.infoChipSuccess
      : tone === 'warning'
        ? styles.infoChipWarning
        : '';

  return (
    <span className={`${styles.infoChip} ${toneClass}`} data-ui="info">
      {children}
    </span>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return <InfoChip>{children}</InfoChip>;
}

export function Button({
  children,
  className,
  tone = 'secondary',
  type = 'button',
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  const toneClass =
    tone === 'primary'
      ? styles.buttonPrimary
      : tone === 'danger'
        ? styles.buttonDanger
        : styles.buttonSecondary;

  return (
    <button
      className={`${styles.button} ${toneClass} ${className ?? ''}`}
      type={type}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

export function ActionButton({
  children,
  className,
  intent = 'neutral',
  priority = 'secondary',
  type = 'button',
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  intent?: ActionIntent;
  priority?: ActionPriority;
}) {
  const intentClass =
    intent === 'success'
      ? styles.actionSuccess
      : intent === 'warning'
        ? styles.actionWarning
        : intent === 'danger'
          ? styles.actionDanger
          : styles.actionNeutral;
  const priorityClass =
    priority === 'primary'
      ? styles.actionPrimary
      : priority === 'ghost'
        ? styles.actionGhost
        : styles.actionSecondary;

  return (
    <button
      className={`${styles.actionButton} ${intentClass} ${priorityClass} ${
        className ?? ''
      }`}
      data-action-intent={intent}
      data-action-priority={priority}
      data-ui="action"
      type={type}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  className,
  type = 'button',
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${styles.iconButton} ${className ?? ''}`}
      type={type}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

export function SegmentedControl<TValue extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange(value: TValue): void;
  options: Array<{ label: string; value: TValue }>;
  value: TValue;
}) {
  return (
    <div aria-label={label} className={styles.segmented} role="group">
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className={`${styles.segment} ${
            option.value === value ? styles.segmentActive : ''
          }`}
          key={option.value}
          onClick={() => onChange(option.value)}
          data-ui="filter"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FormField({
  children,
  error,
  hint,
  label,
}: {
  children: ReactNode;
  error?: string | null;
  hint?: string;
  label: string;
}) {
  return (
    <label className={styles.formField}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <small className={styles.fieldError}>{error}</small> : null}
    </label>
  );
}

export function ListCard({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <article
      className={`${styles.listCard} ${
        tone === 'warning' ? styles.listCardWarning : ''
      }`}
    >
      {children}
    </article>
  );
}

export function EmptyState({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  return (
    <section className={styles.emptyState}>
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}

export function ErrorState({
  message,
  title = 'Something went wrong',
}: {
  message: string;
  title?: string;
}) {
  return (
    <section className={`${styles.emptyState} ${styles.errorState}`}>
      <h2>{title}</h2>
      <p role="alert">{message}</p>
    </section>
  );
}

export function SkeletonBlock() {
  return (
    <div aria-hidden="true" className={styles.skeleton}>
      <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
      <span className={styles.skeletonLine} />
      <span className={styles.skeletonLine} />
    </div>
  );
}

export function BottomSheet({ children }: { children: ReactNode }) {
  return <div className={overlayStyles.bottomSheet}>{children}</div>;
}

export function Drawer({
  children,
  footer,
  onClose,
  title,
}: {
  children: ReactNode;
  footer?: ReactNode;
  onClose(): void;
  title: string;
}) {
  useEscapeToClose(onClose);

  return (
    <div
      className={overlayStyles.modalBackdrop}
      onMouseDown={(event) => closeOnBackdropMouseDown(event, onClose)}
    >
      <aside
        aria-labelledby="drawer-title"
        aria-modal="true"
        className={overlayStyles.drawer}
        role="dialog"
      >
        <header className={overlayStyles.modalHeader}>
          <h2 id="drawer-title">{title}</h2>
          <IconButton aria-label="Close" onClick={onClose}>
            X
          </IconButton>
        </header>
        <div className={overlayStyles.modalBody}>{children}</div>
        {footer ? (
          <footer className={overlayStyles.modalFooter}>{footer}</footer>
        ) : null}
      </aside>
    </div>
  );
}

export function Sheet({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose(): void;
  title: string;
}) {
  useEscapeToClose(onClose);

  return (
    <div
      className={overlayStyles.sheetBackdrop}
      onMouseDown={(event) => closeOnBackdropMouseDown(event, onClose)}
    >
      <section
        aria-labelledby="sheet-title"
        aria-modal="true"
        className={overlayStyles.sheet}
        role="dialog"
      >
        <header className={overlayStyles.modalHeader}>
          <h2 id="sheet-title">{title}</h2>
          <IconButton aria-label="Close" onClick={onClose}>
            X
          </IconButton>
        </header>
        <div className={overlayStyles.modalBody}>{children}</div>
      </section>
    </div>
  );
}

export function Popover({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <section className={overlayStyles.popover} role="dialog">
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

export function Modal({
  children,
  className,
  description,
  footer,
  mobilePresentation = 'dialog',
  onClose,
  title,
}: {
  children: ReactNode;
  className?: string;
  description?: string;
  footer?: ReactNode;
  mobilePresentation?: 'dialog' | 'fullScreen';
  onClose(): void;
  title: string;
}) {
  useEscapeToClose(onClose);

  return (
    <div
      className={`${overlayStyles.modalBackdrop} ${
        mobilePresentation === 'fullScreen'
          ? overlayStyles.fullScreenBackdrop
          : ''
      }`}
      onMouseDown={(event) => closeOnBackdropMouseDown(event, onClose)}
    >
      <section
        aria-describedby={description ? 'modal-description' : undefined}
        aria-labelledby="modal-title"
        aria-modal="true"
        className={`${overlayStyles.modal} ${
          mobilePresentation === 'fullScreen'
            ? overlayStyles.fullScreenModal
            : ''
        } ${className ?? ''}`}
        role="dialog"
      >
        <header className={overlayStyles.modalHeader}>
          <div>
            <h2 id="modal-title">{title}</h2>
            {description ? <p id="modal-description">{description}</p> : null}
          </div>
          <button
            aria-label="Close"
            className={styles.iconButton}
            onClick={onClose}
            type="button"
          >
            X
          </button>
        </header>
        <div className={overlayStyles.modalBody}>{children}</div>
        {footer ? (
          <footer className={overlayStyles.modalFooter}>{footer}</footer>
        ) : null}
      </section>
    </div>
  );
}
