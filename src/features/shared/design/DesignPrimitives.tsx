import {
  forwardRef,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import {
  closeOnBackdropMouseDown,
  trapDialogFocus,
  useDialogScrollLock,
  useEscapeToClose,
  useInitialDialogFocus,
} from './dialogDismiss';
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

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function IconButton(
  { children, className, type = 'button', ...buttonProps },
  ref,
) {
  return (
    <button
      className={`${styles.iconButton} ${className ?? ''}`}
      ref={ref}
      type={type}
      {...buttonProps}
    >
      {children}
    </button>
  );
});

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

type OverlayLayoutProps = {
  backdropTestId?: string | undefined;
  bodyClassName?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  closeLabel?: string | undefined;
  description?: string | undefined;
  footer?: ReactNode | undefined;
  footerClassName?: string | undefined;
  headerAside?: ReactNode | undefined;
  headerAsideClassName?: string | undefined;
  headerClassName?: string | undefined;
  kicker?: string | undefined;
  onClose(): void;
  title: ReactNode;
};

function OverlayFrame({
  backdropClassName,
  backdropTestId,
  bodyClassName,
  children,
  className,
  closeLabel = 'Close',
  containerClassName,
  description,
  footer,
  footerClassName,
  headerAside,
  headerAsideClassName,
  headerClassName,
  kicker,
  onClose,
  title,
}: OverlayLayoutProps & {
  backdropClassName?: string | undefined;
  containerClassName: string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEscapeToClose(onClose);
  useDialogScrollLock();
  useInitialDialogFocus({
    dialogRef,
    initialFocusRef: closeButtonRef,
  });

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    trapDialogFocus(event, dialogRef.current);
  }

  return (
    <div
      data-testid={backdropTestId}
      className={`${overlayStyles.modalBackdrop} ${backdropClassName ?? ''}`}
      onPointerDown={(event) => closeOnBackdropMouseDown(event, onClose)}
    >
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`${containerClassName} ${className ?? ''}`}
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <header
          className={`${overlayStyles.modalHeader} ${headerClassName ?? ''}`}
        >
          <div className={overlayStyles.modalHeaderCopy}>
            {kicker ? (
              <p className={overlayStyles.modalKicker}>{kicker}</p>
            ) : null}
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          {headerAside ? (
            <div
              className={`${overlayStyles.modalHeaderAside} ${
                headerAsideClassName ?? ''
              }`}
            >
              {headerAside}
            </div>
          ) : null}
          <IconButton
            aria-label={closeLabel}
            className={overlayStyles.modalCloseButton}
            onClick={onClose}
            ref={closeButtonRef}
          >
            X
          </IconButton>
        </header>
        <div className={`${overlayStyles.modalBody} ${bodyClassName ?? ''}`}>
          {children}
        </div>
        {footer ? (
          <footer
            className={`${overlayStyles.modalFooter} ${footerClassName ?? ''}`}
          >
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
  );
}

export function Drawer({
  children,
  footer,
  onClose,
  title,
  ...layoutProps
}: OverlayLayoutProps) {
  return (
    <OverlayFrame
      {...layoutProps}
      children={children}
      containerClassName={overlayStyles.drawer ?? ''}
      footer={footer}
      onClose={onClose}
      title={title}
    />
  );
}

export function Sheet({
  children,
  onClose,
  title,
  ...layoutProps
}: OverlayLayoutProps) {
  return (
    <OverlayFrame
      {...layoutProps}
      backdropClassName={overlayStyles.sheetBackdrop}
      children={children}
      containerClassName={overlayStyles.sheet ?? ''}
      onClose={onClose}
      title={title}
    />
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
  backdropTestId,
  children,
  closeLabel,
  className,
  bodyClassName,
  description,
  footer,
  footerClassName,
  headerAside,
  headerAsideClassName,
  headerClassName,
  kicker,
  mobilePresentation = 'dialog',
  onClose,
  title,
}: {
  backdropTestId?: string | undefined;
  bodyClassName?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  closeLabel?: string | undefined;
  description?: string | undefined;
  footer?: ReactNode | undefined;
  footerClassName?: string | undefined;
  headerAside?: ReactNode | undefined;
  headerAsideClassName?: string | undefined;
  headerClassName?: string | undefined;
  kicker?: string | undefined;
  mobilePresentation?: 'dialog' | 'fullScreen';
  onClose(): void;
  title: ReactNode;
}) {
  return (
    <OverlayFrame
      backdropClassName={
        mobilePresentation === 'fullScreen'
          ? overlayStyles.fullScreenBackdrop
          : undefined
      }
      backdropTestId={backdropTestId}
      bodyClassName={bodyClassName}
      children={children}
      className={`${
        mobilePresentation === 'fullScreen' ? overlayStyles.fullScreenModal : ''
      } ${className ?? ''}`}
      closeLabel={closeLabel}
      containerClassName={overlayStyles.modal ?? ''}
      description={description}
      footer={footer}
      footerClassName={footerClassName}
      headerAside={headerAside}
      headerAsideClassName={headerAsideClassName}
      headerClassName={headerClassName}
      kicker={kicker}
      onClose={onClose}
      title={title}
    />
  );
}
