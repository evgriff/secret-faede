import { useState, type FormEvent } from 'react';

import type { GardenPlot } from '../../domain/gardens/GardenRepository';
import { clampPlotDimension, maxPlotFeet, minPlotFeet } from './gardenMath';
import styles from './GardenEditorScreen.module.css';

interface PlotSettingsModalProps {
  onApply(widthFt: number, depthFt: number): void;
  onClose(): void;
  plot: GardenPlot;
}

export function PlotSettingsModal({
  onApply,
  onClose,
  plot,
}: PlotSettingsModalProps) {
  const [depthFt, setDepthFt] = useState(String(plot.depthFt));
  const [widthFt, setWidthFt] = useState(String(plot.widthFt));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply(
      clampPlotDimension(Number(widthFt)),
      clampPlotDimension(Number(depthFt)),
    );
  }

  return (
    <div className={styles.modalBackdrop}>
      <section
        aria-labelledby="plot-settings-title"
        aria-modal="true"
        className={styles.modal}
        role="dialog"
      >
        <div className={styles.modalHeader}>
          <h2 id="plot-settings-title">Plot</h2>
          <button
            aria-label="Close"
            className={styles.iconButton}
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>
        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Width in feet</span>
            <input
              inputMode="numeric"
              max={maxPlotFeet}
              min={minPlotFeet}
              onChange={(event) => setWidthFt(event.currentTarget.value)}
              step="1"
              type="number"
              value={widthFt}
            />
          </label>
          <label className={styles.field}>
            <span>Depth in feet</span>
            <input
              inputMode="numeric"
              max={maxPlotFeet}
              min={minPlotFeet}
              onChange={(event) => setDepthFt(event.currentTarget.value)}
              step="1"
              type="number"
              value={depthFt}
            />
          </label>
          <button className={styles.primaryButton} type="submit">
            Save plot
          </button>
        </form>
      </section>
    </div>
  );
}
