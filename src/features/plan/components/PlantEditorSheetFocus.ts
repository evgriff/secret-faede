import type { KeyboardEvent } from 'react';

export function trapPlantEditorFocus(
  event: KeyboardEvent<HTMLElement>,
  dialog: HTMLElement | null,
) {
  if (!dialog) {
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

function getFocusableElements(element: HTMLElement) {
  return [
    ...element.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), details summary, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((node) => !node.hasAttribute('hidden'));
}
