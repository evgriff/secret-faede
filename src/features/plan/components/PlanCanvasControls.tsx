import styles from './PlanCanvasTools.module.css';
import type { CanvasZoomState } from '../hooks/usePlanCanvasView';

export interface PlanCanvasLayers {
  grid: boolean;
  labels: boolean;
  miniMap: boolean;
  sun: boolean;
  warnings: boolean;
}

export function PlanCanvasControls({
  layers,
  onLayersChange,
  onFitView,
  onResetView,
  onZoomIn,
  onZoomOut,
  zoom,
  zoomState,
}: {
  layers: PlanCanvasLayers;
  onLayersChange(layers: PlanCanvasLayers): void;
  onFitView(): void;
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
          aria-pressed={zoomState === 'fit'}
          onClick={onFitView}
          type="button"
        >
          Fit
        </button>
        <button
          aria-pressed={zoomState === 'actual'}
          onClick={onResetView}
          type="button"
        >
          100%
        </button>
        <button aria-label="Zoom out" onClick={onZoomOut} type="button">
          -
        </button>
        <span className={styles.zoomReadout} aria-label="Current zoom">
          {Math.round(zoom * 100)}%
        </span>
        <button aria-label="Zoom in" onClick={onZoomIn} type="button">
          +
        </button>
      </div>
      <div className={styles.layerControls} aria-label="Layer visibility">
        <LayerButton
          active={layers.grid}
          label="Grid"
          onClick={() => onLayersChange({ ...layers, grid: !layers.grid })}
        />
        <LayerButton
          active={layers.labels}
          label="Labels"
          onClick={() => onLayersChange({ ...layers, labels: !layers.labels })}
        />
        <LayerButton
          active={layers.sun}
          label="Sun"
          onClick={() => onLayersChange({ ...layers, sun: !layers.sun })}
        />
        <LayerButton
          active={layers.warnings}
          label="Warnings"
          onClick={() =>
            onLayersChange({ ...layers, warnings: !layers.warnings })
          }
        />
        <LayerButton
          active={layers.miniMap}
          label="Map"
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
}: {
  active: boolean;
  label: string;
  onClick(): void;
}) {
  return (
    <button aria-pressed={active} onClick={onClick} type="button">
      {label}
    </button>
  );
}
