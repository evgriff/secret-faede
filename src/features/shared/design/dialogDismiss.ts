import {
  useEffect,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';

export function closeOnBackdropMouseDown(
  event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>,
  onClose: () => void,
) {
  if (event.target === event.currentTarget) {
    onClose();
  }
}

export function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
}

export function useDialogScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const lockCount = Number(document.body.dataset.dialogScrollLocks ?? '0');

    if (lockCount === 0) {
      const currentBodyPaddingRight = window.getComputedStyle(
        document.body,
      ).paddingRight;
      const documentWidth = document.documentElement.clientWidth;
      const scrollbarWidth =
        documentWidth > 0 ? Math.max(window.innerWidth - documentWidth, 0) : 0;

      document.body.dataset.dialogPreviousOverflow =
        document.body.style.overflow;
      document.body.dataset.dialogPreviousPaddingRight =
        document.body.style.paddingRight;
      document.body.style.overflow = 'hidden';

      if (scrollbarWidth > 0) {
        const currentPaddingRight = Number.parseFloat(currentBodyPaddingRight);
        const safePaddingRight = Number.isFinite(currentPaddingRight)
          ? currentPaddingRight
          : 0;

        document.body.style.paddingRight = `${
          safePaddingRight + scrollbarWidth
        }px`;
      }
    }

    document.body.dataset.dialogScrollLocks = String(lockCount + 1);

    return () => {
      const nextCount = Math.max(
        Number(document.body.dataset.dialogScrollLocks ?? '1') - 1,
        0,
      );

      if (nextCount === 0) {
        document.body.style.overflow =
          document.body.dataset.dialogPreviousOverflow ?? '';
        document.body.style.paddingRight =
          document.body.dataset.dialogPreviousPaddingRight ?? '';
        delete document.body.dataset.dialogPreviousOverflow;
        delete document.body.dataset.dialogPreviousPaddingRight;
        delete document.body.dataset.dialogScrollLocks;
        return;
      }

      document.body.dataset.dialogScrollLocks = String(nextCount);
    };
  }, [enabled]);
}

export function useInitialDialogFocus({
  dialogRef,
  enabled = true,
  initialFocusRef,
}: {
  dialogRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    window.requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ?? getFocusableElements(dialogRef.current)[0];

      target?.focus();
    });
  }, [dialogRef, enabled, initialFocusRef]);
}

export function trapDialogFocus(
  event: KeyboardEvent<HTMLElement>,
  dialog: HTMLElement | null,
) {
  if (event.key !== 'Tab' || !dialog) {
    return;
  }

  const focusable = getFocusableElements(dialog);
  const first = focusable[0];
  const last = focusable.at(-1);

  if (!first || !last) {
    return;
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function getFocusableElements(element: HTMLElement | null) {
  if (!element) {
    return [];
  }

  return [
    ...element.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), details summary, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter(
    (node) =>
      !node.hasAttribute('hidden') &&
      node.getAttribute('aria-hidden') !== 'true' &&
      node.offsetParent !== null,
  );
}
