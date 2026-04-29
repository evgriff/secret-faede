import styles from './PlanCanvasTools.module.css';
import type { CanvasZoomState } from '../hooks/usePlanCanvasView';

export interface PlanCanvasLayers {
  grid: boolean;
  labels: boolean;
  miniMap: boolean;
  sun: boolean;
}

export function PlanCanvasControls({
  isPanMode,
  layers,
  onLayersChange,
  onFitView,
  onPanModeChange,
  onResetView,
  onZoomIn,
  onZoomOut,
  zoom,
  zoomState,
}: {
  isPanMode: boolean;
  layers: PlanCanvasLayers;
  onLayersChange(layers: PlanCanvasLayers): void;
  onFitView(): void;
  onPanModeChange(value: boolean): void;
  onResetView(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  zoom: number;
  zoomState: CanvasZoomState;
}) {
  return (
    <div
      className={styles.canvasHud}
      data-layer-control="true"
      aria-label="Canvas controls"
    >
      <div className={styles.zoomControls} aria-label="Zoom controls">
        <button
          aria-label="Pan canvas"
          aria-pressed={isPanMode}
          onClick={() => onPanModeChange(!isPanMode)}
          title="Pan canvas"
          type="button"
        >
          Pan
        </button>
        <button
          aria-label="Fit"
          aria-pressed={zoomState === 'fit'}
          onClick={onFitView}
          title="Fit"
          type="button"
        >
          Fit
        </button>
        <button
          aria-label="100%"
          aria-pressed={zoomState === 'actual'}
          onClick={onResetView}
          title="100%"
          type="button"
        >
          1:1
        </button>
        <button
          aria-label="Zoom out"
          onClick={onZoomOut}
          title="Zoom out"
          type="button"
        >
          -
        </button>
        <span className={styles.zoomReadout} aria-label="Current zoom">
          {Math.round(zoom * 100)}%
        </span>
        <button
          aria-label="Zoom in"
          onClick={onZoomIn}
          title="Zoom in"
          type="button"
        >
          +
        </button>
      </div>
      <div className={styles.layerControls} aria-label="Layer visibility">
        <LayerButton
          active={layers.grid}
          label="Grid"
          shortLabel="#"
          onClick={() => onLayersChange({ ...layers, grid: !layers.grid })}
        />
        <LayerButton
          active={layers.labels}
          label="Labels"
          shortLabel="Aa"
          onClick={() => onLayersChange({ ...layers, labels: !layers.labels })}
        />
        <LayerButton
          active={layers.sun}
          label="Sun"
          shortLabel="Sun"
          onClick={() => onLayersChange({ ...layers, sun: !layers.sun })}
        />
        <LayerButton
          active={layers.miniMap}
          label="Overview"
          shortLabel="Map"
          onClick={() =>
            onLayersChange({ ...layers, miniMap: !layers.miniMap })
          }
        />
      </div>
    </div>
  );
}

function LayerButton({
  active,
  label,
  onClick,
  shortLabel,
}: {
  active: boolean;
  label: string;
  onClick(): void;
  shortLabel: string;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      title={label}
      type="button"
    >
      {shortLabel}
    </button>
  );
}
