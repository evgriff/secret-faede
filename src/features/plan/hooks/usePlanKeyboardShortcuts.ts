import { useEffect } from 'react';

import { defaultPlanSnapFt } from '../planInteractionGeometry';
import type { PlanMode } from '../planModes';

export function usePlanKeyboardShortcuts({
  deleteSelectedItem,
  nudgeSelection,
  redoGardenChange,
  saveGarden,
  selectAllForCurrentLayer,
  setActiveMode,
  undoGardenChange,
}: {
  deleteSelectedItem(): void;
  nudgeSelection(deltaXFt: number, deltaYFt: number): void;
  redoGardenChange(): void;
  saveGarden(): void;
  selectAllForCurrentLayer(): void;
  setActiveMode(mode: PlanMode): void;
  undoGardenChange(): void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === 's') {
        event.preventDefault();
        saveGarden();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redoGardenChange();
        } else {
          undoGardenChange();
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === 'y') {
        event.preventDefault();
        redoGardenChange();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === 'a') {
        event.preventDefault();
        selectAllForCurrentLayer();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelectedItem();
        return;
      }

      const nudge = getNudgeFromKey(event.key, event.shiftKey);

      if (nudge) {
        event.preventDefault();
        nudgeSelection(nudge.deltaXFt, nudge.deltaYFt);
        return;
      }

      const mode = getModeFromKey(key);

      if (mode) {
        setActiveMode(mode);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    deleteSelectedItem,
    nudgeSelection,
    redoGardenChange,
    saveGarden,
    selectAllForCurrentLayer,
    setActiveMode,
    undoGardenChange,
  ]);
}

function getModeFromKey(key: string): PlanMode | null {
  const shortcuts: Record<string, PlanMode> = {
    b: 'structure',
    p: 'plant',
  };

  return shortcuts[key] ?? null;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
}

function getNudgeFromKey(key: string, shiftKey: boolean) {
  const distanceFt = shiftKey ? 1 : defaultPlanSnapFt;

  switch (key) {
    case 'ArrowDown':
      return { deltaXFt: 0, deltaYFt: distanceFt };
    case 'ArrowLeft':
      return { deltaXFt: -distanceFt, deltaYFt: 0 };
    case 'ArrowRight':
      return { deltaXFt: distanceFt, deltaYFt: 0 };
    case 'ArrowUp':
      return { deltaXFt: 0, deltaYFt: -distanceFt };
    default:
      return null;
  }
}
