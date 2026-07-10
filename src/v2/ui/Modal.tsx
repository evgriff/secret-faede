import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import './foundation.css';
import styles from './Modal.module.css';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export type OverlayCloseReason = 'close-button' | 'escape' | 'backdrop';

export interface ModalProps {
  children: ReactNode;
  description?: ReactNode;
  dismissOnBackdrop?: boolean;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose(reason: OverlayCloseReason): void;
  title: string;
  variant?: 'dialog' | 'drawer';
}

export function Modal({
  children,
  description,
  dismissOnBackdrop = true,
  footer,
  initialFocusRef,
  isOpen,
  onClose,
  title,
  variant = 'dialog',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [portalNode] = useState(() => {
    if (typeof document === 'undefined') {
      return null;
    }
    const node = document.createElement('div');
    node.dataset.sf2OverlayPortal = 'true';
    return node;
  });

  useEffect(() => {
    if (!isOpen || !portalNode) {
      return;
    }

    document.body.append(portalNode);
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== portalNode,
    );
    const snapshots = background.map((element) => ({
      ariaHidden: element.getAttribute('aria-hidden'),
      element,
      inert: element.inert,
    }));

    background.forEach((element) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });

    return () => {
      snapshots.forEach(({ ariaHidden, element, inert }) => {
        element.inert = inert;
        if (ariaHidden === null) {
          element.removeAttribute('aria-hidden');
        } else {
          element.setAttribute('aria-hidden', ariaHidden);
        }
      });
      document.body.style.overflow = bodyOverflow;
      portalNode.remove();
    };
  }, [isOpen, portalNode]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const timer = window.setTimeout(() => {
      const initialTarget = initialFocusRef?.current;
      const dialog = dialogRef.current;
      const firstFocusable =
        dialog?.querySelector<HTMLElement>(focusableSelector);
      (initialTarget ?? firstFocusable ?? dialog)?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      const returnTarget = returnFocusRef.current;
      if (returnTarget?.isConnected) {
        returnTarget.focus();
      }
    };
  }, [initialFocusRef, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose('escape');
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => {
        const computedStyle = window.getComputedStyle(element);
        return (
          !element.hidden &&
          computedStyle.display !== 'none' &&
          computedStyle.visibility !== 'hidden'
        );
      });

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1);
      const activeElement = document.activeElement;
      if (
        event.shiftKey &&
        (activeElement === first || !dialog.contains(activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === last || !dialog.contains(activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !portalNode) {
    return null;
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (dismissOnBackdrop && event.target === event.currentTarget) {
      onClose('backdrop');
    }
  }

  return createPortal(
    <div className={styles.layer} data-sf-v2="overlay">
      <div
        className={`${styles.backdrop} ${variant === 'drawer' ? styles.drawerBackdrop : ''}`.trim()}
        onMouseDown={handleBackdropClick}
      >
        <div
          aria-describedby={description ? descriptionId : undefined}
          aria-labelledby={titleId}
          aria-modal="true"
          className={`${styles.dialog} ${variant === 'drawer' ? styles.drawer : ''}`.trim()}
          ref={dialogRef}
          role="dialog"
          tabIndex={-1}
        >
          <header className={styles.header}>
            <div className={styles.headingGroup}>
              <h2 className={styles.title} id={titleId}>
                {title}
              </h2>
              {description ? (
                <div className={styles.description} id={descriptionId}>
                  {description}
                </div>
              ) : null}
            </div>
            <button
              aria-label={`Close ${title}`}
              className={styles.closeButton}
              onClick={() => onClose('close-button')}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div className={styles.content}>{children}</div>
          {footer ? <footer className={styles.footer}>{footer}</footer> : null}
        </div>
      </div>
    </div>,
    portalNode,
  );
}
