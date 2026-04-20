import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

import { useAuth } from '../auth/auth-context';
import { AddPlantModal } from './AddPlantModal';
import {
  clientPointToPlotFeet,
  formatFeet,
  pixelsPerFoot,
  plotFeetToPixels,
} from './gardenMath';
import styles from './GardenEditorScreen.module.css';
import { PlantIcon } from './PlantIcon';
import { PlotSettingsModal } from './PlotSettingsModal';
import { useGarden } from './useGarden';

export function GardenEditorScreen() {
  const { state } = useAuth();
  const userId = state.user?.uid ?? null;
  const {
    addPlant,
    applyPlotSize,
    dirty,
    error,
    garden,
    movePlant,
    saveGarden,
    saveStatus,
    selectedPlantId,
    setSelectedPlantId,
    status,
  } = useGarden(userId);
  const [draggingPlantId, setDraggingPlantId] = useState<string | null>(null);
  const [isAddPlantOpen, setIsAddPlantOpen] = useState(false);
  const [isPlotSettingsOpen, setIsPlotSettingsOpen] = useState(false);
  const dragStateRef = useRef<{
    moved: boolean;
    plantId: string;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  if (status === 'error') {
    return (
      <section className="pageShell pageCard stack">
        <h1 className="pageTitle">Garden editor</h1>
        <p className={styles.error} role="alert">
          {error ?? 'Unable to load your garden.'}
        </p>
      </section>
    );
  }

  if (status === 'loading' || !garden) {
    return <div className="pageShell pageCard">Loading your garden...</div>;
  }

  const activeGarden = garden;
  const selectedPlant =
    activeGarden.plants.find((plant) => plant.id === selectedPlantId) ?? null;
  const plotStyle = {
    '--cell-size': `${pixelsPerFoot}px`,
    '--plot-height': `${activeGarden.plot.depthFt * pixelsPerFoot}px`,
    '--plot-width': `${activeGarden.plot.widthFt * pixelsPerFoot}px`,
  } as CSSProperties;
  const topRulerTicks = createRulerTicks(activeGarden.plot.widthFt);
  const leftRulerTicks = createRulerTicks(activeGarden.plot.depthFt);

  function handlePlantPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
  ) {
    event.preventDefault();
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    dragStateRef.current = {
      moved: false,
      plantId,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    setDraggingPlantId(plantId);
    setSelectedPlantId(plantId);
  }

  function handlePlantPointerMove(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
  ) {
    if (draggingPlantId !== plantId) {
      return;
    }

    const dragState = dragStateRef.current;

    if (!dragState || dragState.plantId !== plantId) {
      return;
    }

    const hasMoved =
      Math.abs(event.clientX - dragState.startClientX) > 3 ||
      Math.abs(event.clientY - dragState.startClientY) > 3;

    if (!hasMoved && !dragState.moved) {
      return;
    }

    dragState.moved = true;
    const rect = plotRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    movePlant(
      plantId,
      clientPointToPlotFeet(event, rect, activeGarden.plot),
      false,
    );
  }

  function handlePlantPointerEnd(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
  ) {
    if (draggingPlantId !== plantId) {
      return;
    }

    const dragState = dragStateRef.current;
    const rect = plotRef.current?.getBoundingClientRect();

    if (rect && dragState?.moved) {
      movePlant(
        plantId,
        clientPointToPlotFeet(event, rect, activeGarden.plot),
        true,
      );
    }

    if (
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
    setDraggingPlantId(null);
  }

  return (
    <section className={styles.screen} data-route-shell="true">
      <header className={styles.toolbar}>
        <div className={styles.titleGroup}>
          <h1>Garden editor</h1>
          <p>Plan one saved plot with foot-accurate plant placement.</p>
        </div>
        <div className={styles.actions}>
          <span className={styles.dimensionBadge}>
            {activeGarden.plot.widthFt} ft by {activeGarden.plot.depthFt} ft
          </span>
          <button
            className={styles.secondaryButton}
            onClick={() => setIsPlotSettingsOpen(true)}
            type="button"
          >
            Plot
          </button>
          {dirty ? (
            <button
              className={styles.primaryButton}
              disabled={saveStatus === 'saving'}
              onClick={() => void saveGarden()}
              type="button"
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save'}
            </button>
          ) : null}
          <button
            aria-label="Add"
            className={styles.addButton}
            onClick={() => setIsAddPlantOpen(true)}
            type="button"
          >
            +
          </button>
        </div>
      </header>

      <div className={styles.statusRow}>
        <div>
          <span className={styles.statusLabel}>Selection</span>
          {selectedPlant ? (
            <p className={styles.positionReadout}>
              X: {formatFeet(selectedPlant.xFt)} ft, Y:{' '}
              {formatFeet(selectedPlant.yFt)} ft
            </p>
          ) : (
            <p className={styles.positionReadout}>No plant selected</p>
          )}
        </div>
        <div className={styles.saveState}>
          {dirty ? <p className={styles.unsaved}>Unsaved changes</p> : null}
          {!dirty && saveStatus === 'saved' ? (
            <p className={styles.saved} role="status">
              Saved
            </p>
          ) : null}
        </div>
        {saveStatus === 'error' && error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className={styles.viewport} data-testid="plot-viewport">
        <div className={styles.workbench}>
          <div
            className={styles.plotShell}
            data-testid="plot-shell"
            style={plotStyle}
          >
            <div className={styles.rulerCorner} aria-hidden="true">
              ft
            </div>
            <div className={styles.topRuler} aria-hidden="true">
              {topRulerTicks.map((tick) => (
                <span
                  className={`${styles.topTick} ${
                    tick === 0 ? styles.startTopTick : ''
                  } ${
                    tick === activeGarden.plot.widthFt ? styles.endTopTick : ''
                  }`}
                  key={`x-${tick}`}
                  style={{ left: `${tick * pixelsPerFoot}px` }}
                >
                  {tick}
                </span>
              ))}
            </div>
            <div className={styles.leftRuler} aria-hidden="true">
              {leftRulerTicks.map((tick) => (
                <span
                  className={`${styles.leftTick} ${
                    tick === 0 ? styles.startLeftTick : ''
                  } ${
                    tick === activeGarden.plot.depthFt ? styles.endLeftTick : ''
                  }`}
                  key={`y-${tick}`}
                  style={{ top: `${tick * pixelsPerFoot}px` }}
                >
                  {tick}
                </span>
              ))}
            </div>
            <div
              aria-label={`${activeGarden.plot.widthFt} by ${activeGarden.plot.depthFt} foot garden plot`}
              className={styles.plot}
              data-testid="garden-plot"
              ref={plotRef}
              role="group"
            >
              <div className={styles.plotMeta} aria-hidden="true">
                <span>1 square = 1 ft</span>
                <span>
                  {activeGarden.plot.widthFt} x {activeGarden.plot.depthFt} ft
                </span>
              </div>
              {activeGarden.plants.map((plant, index) => {
                const position = plotFeetToPixels(plant);
                const plantStyle = {
                  left: `${position.left}px`,
                  top: `${position.top}px`,
                };
                const isSelected = plant.id === selectedPlantId;
                const isDragging = plant.id === draggingPlantId;

                return (
                  <button
                    aria-label={`Plant ${index + 1} at X: ${formatFeet(
                      plant.xFt,
                    )} ft, Y: ${formatFeet(plant.yFt)} ft`}
                    className={`${styles.plant} ${
                      isSelected ? styles.selectedPlant : ''
                    } ${isDragging ? styles.draggingPlant : ''}`}
                    key={plant.id}
                    onClick={() => setSelectedPlantId(plant.id)}
                    onPointerCancel={(event) =>
                      handlePlantPointerEnd(event, plant.id)
                    }
                    onPointerDown={(event) =>
                      handlePlantPointerDown(event, plant.id)
                    }
                    onPointerMove={(event) =>
                      handlePlantPointerMove(event, plant.id)
                    }
                    onPointerUp={(event) =>
                      handlePlantPointerEnd(event, plant.id)
                    }
                    style={plantStyle}
                    type="button"
                  >
                    <PlantIcon title="" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {isPlotSettingsOpen ? (
        <PlotSettingsModal
          onApply={(widthFt, depthFt) => {
            applyPlotSize(widthFt, depthFt);
            setIsPlotSettingsOpen(false);
          }}
          onClose={() => setIsPlotSettingsOpen(false)}
          plot={activeGarden.plot}
        />
      ) : null}

      {isAddPlantOpen ? (
        <AddPlantModal
          onAddPlant={() => {
            addPlant();
            setIsAddPlantOpen(false);
          }}
          onClose={() => setIsAddPlantOpen(false)}
        />
      ) : null}
    </section>
  );
}

function createRulerTicks(sizeFt: number) {
  const ticks = [];

  for (let tick = 0; tick <= sizeFt; tick += 2) {
    ticks.push(tick);
  }

  if (ticks.at(-1) !== sizeFt) {
    ticks.push(sizeFt);
  }

  return ticks;
}
