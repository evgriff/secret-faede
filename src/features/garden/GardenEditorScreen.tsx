import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';

import { useServices } from '../../app/providers';
import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  Planting,
  SunExposure,
  SunShadeArea,
  Structure,
  StructureType,
  WaterRecommendation,
  WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';
import { LoadingState } from '../../shared/ui/LoadingState';
import { useNetworkStatus } from '../../shared/network/networkStatus';
import { useAuth } from '../auth/auth-context';
import { AddPlantModal } from './AddPlantModal';
import { clientPointToPlotFeet, formatFeet, pixelsPerFoot } from './gardenMath';
import {
  describeFootprint,
  findPlanWarnings,
  getPlantingFootprint,
  getStructureFootprint,
  hasWarningForItem,
  type FootRect,
  type PlanWarning,
} from './gardenPlanning';
import styles from './GardenEditorScreen.module.css';
import { PlantIcon } from './PlantIcon';
import { PlotSettingsModal } from './PlotSettingsModal';
import {
  cropSunRequirementMet,
  findSunShadeLayer,
  getSunAreaAtPoint,
  sunSeasons,
  type SunSeason,
} from './sunShadeEngine';
import { useGarden, type SelectedGardenItem } from './useGarden';

const structureOptions: Array<{ label: string; type: StructureType }> = [
  { label: 'Raised bed', type: 'raisedBed' },
  { label: 'In-ground bed', type: 'inGroundBed' },
  { label: 'Container', type: 'container' },
  { label: 'Pathway', type: 'pathway' },
  { label: 'Trellis', type: 'trellis' },
  { label: 'Fence/wall', type: 'fenceWall' },
  { label: 'Tree/obstacle', type: 'treeObstacle' },
  { label: 'Compost', type: 'compost' },
  { label: 'Water source', type: 'waterSource' },
];

type DragState = {
  item: SelectedGardenItem;
  moved: boolean;
  startClientX: number;
  startClientY: number;
};

export function GardenEditorScreen() {
  const { state } = useAuth();
  const { environment } = useServices();
  const networkStatus = useNetworkStatus();
  const isOffline = networkStatus === 'offline';
  const userId = state.user?.uid ?? null;
  const {
    addPlant,
    addStructure,
    applyPlotSettings,
    dirty,
    error,
    garden,
    movePlant,
    moveStructure,
    paintSunShadeCell,
    recalculateSunShade,
    refreshWeatherAndWatering,
    resizeStructure,
    saveGarden,
    saveStatus,
    selectedItem,
    selectedPlantId,
    selectedStructureId,
    setSelectedItem,
    setSelectedPlantId,
    status,
    updateStructureShade,
  } = useGarden(userId);
  const [draggingPlantId, setDraggingPlantId] = useState<string | null>(null);
  const [draggingStructureId, setDraggingStructureId] = useState<string | null>(
    null,
  );
  const [isAddPlantOpen, setIsAddPlantOpen] = useState(false);
  const [isPlotSettingsOpen, setIsPlotSettingsOpen] = useState(false);
  const [resizingStructureId, setResizingStructureId] = useState<string | null>(
    null,
  );
  const [structureType, setStructureType] =
    useState<StructureType>('raisedBed');
  const [showSunOverlay, setShowSunOverlay] = useState(false);
  const [sunSeason, setSunSeason] = useState<SunSeason>('summer');
  const [manualSunEdit, setManualSunEdit] = useState(false);
  const [manualSunExposure, setManualSunExposure] =
    useState<SunExposure>('partShade');
  const [operationsError, setOperationsError] = useState<string | null>(null);
  const [operationsStatus, setOperationsStatus] = useState<'idle' | 'loading'>(
    'idle',
  );
  const dragStateRef = useRef<DragState | null>(null);
  const resizeStateRef = useRef<{ structureId: string } | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const planWarnings = useMemo(
    () => (garden ? findPlanWarnings(garden) : []),
    [garden],
  );
  const activeSunLayer = useMemo(
    () => (garden ? findSunShadeLayer(garden, sunSeason) : null),
    [garden, sunSeason],
  );
  const nextPlacementSunArea = useMemo(() => {
    if (!garden || !activeSunLayer) {
      return null;
    }

    return getSunAreaAtPoint(activeSunLayer, {
      xFt: garden.plot.widthFt / 2,
      yFt: garden.plot.depthFt / 2,
    });
  }, [activeSunLayer, garden]);

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

  if (status === 'loading' || !garden || !activeSunLayer) {
    return (
      <LoadingState message="Loading your saved plot." title="Loading garden" />
    );
  }

  const activeGarden = garden;
  const selectedPlant =
    activeGarden.plantings.find((plant) => plant.id === selectedPlantId) ??
    null;
  const selectedStructure =
    activeGarden.structures.find(
      (structure) => structure.id === selectedStructureId,
    ) ?? null;
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
      item: { id: plantId, type: 'planting' },
      moved: false,
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

    if (!dragState || dragState.item.id !== plantId) {
      return;
    }

    if (!markDragMoved(event, dragState)) {
      return;
    }

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

    releasePointerCapture(event);
    dragStateRef.current = null;
    setDraggingPlantId(null);
  }

  function handleStructurePointerDown(
    event: PointerEvent<HTMLDivElement>,
    structureId: string,
  ) {
    event.preventDefault();
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    dragStateRef.current = {
      item: { id: structureId, type: 'structure' },
      moved: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    setDraggingStructureId(structureId);
    setSelectedItem({ id: structureId, type: 'structure' });
  }

  function handleStructurePointerMove(
    event: PointerEvent<HTMLDivElement>,
    structureId: string,
  ) {
    if (draggingStructureId !== structureId) {
      return;
    }

    const dragState = dragStateRef.current;

    if (!dragState || dragState.item.id !== structureId) {
      return;
    }

    if (!markDragMoved(event, dragState)) {
      return;
    }

    const rect = plotRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    moveStructure(
      structureId,
      clientPointToPlotFeet(event, rect, activeGarden.plot),
      false,
    );
  }

  function handleStructurePointerEnd(
    event: PointerEvent<HTMLDivElement>,
    structureId: string,
  ) {
    if (draggingStructureId !== structureId) {
      return;
    }

    const dragState = dragStateRef.current;
    const rect = plotRef.current?.getBoundingClientRect();

    if (rect && dragState?.moved) {
      moveStructure(
        structureId,
        clientPointToPlotFeet(event, rect, activeGarden.plot),
        true,
      );
    }

    releasePointerCapture(event);
    dragStateRef.current = null;
    setDraggingStructureId(null);
  }

  function handleResizePointerDown(
    event: PointerEvent<HTMLSpanElement>,
    structureId: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    resizeStateRef.current = { structureId };
    setResizingStructureId(structureId);
    setSelectedItem({ id: structureId, type: 'structure' });
  }

  function handleResizePointerMove(
    event: PointerEvent<HTMLSpanElement>,
    structure: Structure,
  ) {
    if (resizeStateRef.current?.structureId !== structure.id) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const rect = plotRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const point = clientPointToPlotFeet(event, rect, activeGarden.plot);
    resizeStructure(
      structure.id,
      point.xFt - structure.xFt,
      point.yFt - structure.yFt,
    );
  }

  function handleResizePointerEnd(event: PointerEvent<HTMLSpanElement>) {
    if (!resizeStateRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    releasePointerCapture(event);
    resizeStateRef.current = null;
    setResizingStructureId(null);
  }

  async function handleRefreshOperations() {
    if (isOffline) {
      setOperationsError('Weather updates need a connection.');
      return;
    }

    setOperationsStatus('loading');
    setOperationsError(null);

    try {
      await refreshWeatherAndWatering();
    } catch (refreshError) {
      setOperationsError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Unable to update garden operations.',
      );
    } finally {
      setOperationsStatus('idle');
    }
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
          <label className={styles.structurePicker}>
            <span>Structure</span>
            <select
              aria-label="Structure type"
              onChange={(event) =>
                setStructureType(event.currentTarget.value as StructureType)
              }
              value={structureType}
            >
              {structureOptions.map((option) => (
                <option key={option.type} value={option.type}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className={styles.secondaryButton}
            onClick={() => addStructure(structureType)}
            type="button"
          >
            Add structure
          </button>
          <button
            className={styles.secondaryButton}
            onClick={() => setIsPlotSettingsOpen(true)}
            type="button"
          >
            Plot
          </button>
          <button
            className={styles.secondaryButton}
            onClick={recalculateSunShade}
            type="button"
          >
            Recalculate sun
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

      <OperationsPanel
        garden={activeGarden}
        isLoading={operationsStatus === 'loading'}
        isOffline={isOffline}
        onRefresh={() => void handleRefreshOperations()}
        refreshError={operationsError}
      />

      <div className={styles.statusRow}>
        <div>
          <span className={styles.statusLabel}>Selection</span>
          {selectedPlant ? (
            <p className={styles.positionReadout}>
              X: {formatFeet(selectedPlant.xFt)} ft, Y:{' '}
              {formatFeet(selectedPlant.yFt)} ft
            </p>
          ) : selectedStructure ? (
            <p className={styles.positionReadout}>
              X: {formatFeet(selectedStructure.xFt)} ft, Y:{' '}
              {formatFeet(selectedStructure.yFt)} ft
            </p>
          ) : (
            <p className={styles.positionReadout}>No item selected</p>
          )}
        </div>
        <div className={styles.planSummary}>
          {planWarnings.length > 0 ? (
            <p className={styles.warningText} role="status">
              {planWarnings.length} spacing warning
              {planWarnings.length === 1 ? '' : 's'}
            </p>
          ) : (
            <p className={styles.saved}>No spacing warnings</p>
          )}
        </div>
        <div className={styles.sunControls}>
          <label>
            <input
              checked={showSunOverlay}
              onChange={(event) =>
                setShowSunOverlay(event.currentTarget.checked)
              }
              type="checkbox"
            />{' '}
            Sun layer
          </label>
          <select
            aria-label="Sun season"
            onChange={(event) =>
              setSunSeason(event.currentTarget.value as SunSeason)
            }
            value={sunSeason}
          >
            {sunSeasons.map((entry) => (
              <option key={entry.season} value={entry.season}>
                {entry.label}
              </option>
            ))}
          </select>
          <label>
            <input
              checked={manualSunEdit}
              disabled={!showSunOverlay}
              onChange={(event) =>
                setManualSunEdit(event.currentTarget.checked)
              }
              type="checkbox"
            />{' '}
            Paint
          </label>
          <select
            aria-label="Manual sun exposure"
            disabled={!manualSunEdit}
            onChange={(event) =>
              setManualSunExposure(event.currentTarget.value as SunExposure)
            }
            value={manualSunExposure}
          >
            <option value="fullSun">Full sun</option>
            <option value="partSun">Part sun</option>
            <option value="partShade">Part shade</option>
            <option value="fullShade">Full shade</option>
          </select>
        </div>
        <div className={styles.saveState}>
          {dirty ? <p className={styles.unsaved}>Unsaved changes</p> : null}
          {!dirty && saveStatus === 'saved' ? (
            <p className={styles.saved} role="status">
              Saved
            </p>
          ) : null}
          {saveStatus === 'queued' ? (
            <p className={styles.queued} role="status">
              Saved locally
            </p>
          ) : null}
          {isOffline && saveStatus !== 'queued' ? (
            <p className={styles.queued}>Offline edits will queue</p>
          ) : null}
        </div>
        {saveStatus === 'error' && error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className={styles.editorGrid}>
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
                      tick === activeGarden.plot.widthFt
                        ? styles.endTopTick
                        : ''
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
                      tick === activeGarden.plot.depthFt
                        ? styles.endLeftTick
                        : ''
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
                  <span>Scale: 1 square = 1 ft</span>
                  <span>
                    {activeGarden.plot.widthFt} x {activeGarden.plot.depthFt} ft
                  </span>
                  <span className={styles.northArrow}>
                    <span
                      style={{
                        transform: `rotate(${activeGarden.plot.orientationDegrees}deg)`,
                      }}
                    >
                      N
                    </span>
                  </span>
                </div>

                {showSunOverlay ? (
                  <div
                    className={styles.sunOverlay}
                    aria-hidden={!manualSunEdit}
                  >
                    {activeSunLayer.areas.map((area) => (
                      <button
                        aria-label={`Sun cell ${area.xFt}, ${area.yFt}`}
                        className={`${styles.sunCell} ${styles[area.exposure]} ${
                          area.source === 'manual' ? styles.manualSunCell : ''
                        }`}
                        key={area.id}
                        onClick={() => {
                          if (manualSunEdit) {
                            paintSunShadeCell(
                              sunSeason,
                              area.xFt,
                              area.yFt,
                              manualSunExposure,
                            );
                          }
                        }}
                        style={sunAreaStyle(area)}
                        tabIndex={manualSunEdit ? 0 : -1}
                        type="button"
                      />
                    ))}
                  </div>
                ) : null}

                {activeGarden.structures.map((structure) => {
                  const footprint = getStructureFootprint(structure);
                  const isSelected = structure.id === selectedStructureId;
                  const isDragging = structure.id === draggingStructureId;
                  const hasWarning = hasWarningForItem(
                    planWarnings,
                    structure.id,
                  );

                  return (
                    <div
                      aria-label={`${structure.label} at X: ${formatFeet(
                        structure.xFt,
                      )} ft, Y: ${formatFeet(structure.yFt)} ft`}
                      className={`${styles.structure} ${
                        styles[structure.type] ?? ''
                      } ${isSelected ? styles.selectedStructure : ''} ${
                        isDragging ? styles.draggingStructure : ''
                      } ${
                        resizingStructureId === structure.id
                          ? styles.resizingStructure
                          : ''
                      } ${hasWarning ? styles.warningItem : ''}`}
                      key={structure.id}
                      onClick={() =>
                        setSelectedItem({ id: structure.id, type: 'structure' })
                      }
                      onPointerCancel={(event) =>
                        handleStructurePointerEnd(event, structure.id)
                      }
                      onPointerDown={(event) =>
                        handleStructurePointerDown(event, structure.id)
                      }
                      onPointerMove={(event) =>
                        handleStructurePointerMove(event, structure.id)
                      }
                      onPointerUp={(event) =>
                        handleStructurePointerEnd(event, structure.id)
                      }
                      role="button"
                      style={footprintStyle(footprint)}
                      tabIndex={0}
                    >
                      <span>{structure.label}</span>
                      <span
                        aria-hidden="true"
                        className={styles.resizeHandle}
                        onPointerCancel={handleResizePointerEnd}
                        onPointerDown={(event) =>
                          handleResizePointerDown(event, structure.id)
                        }
                        onPointerMove={(event) =>
                          handleResizePointerMove(event, structure)
                        }
                        onPointerUp={handleResizePointerEnd}
                      />
                    </div>
                  );
                })}

                {activeGarden.plantings.map((plant, index) => {
                  const footprint = getPlantingFootprint(plant);
                  const isSelected = plant.id === selectedPlantId;
                  const isDragging = plant.id === draggingPlantId;
                  const hasWarning = hasWarningForItem(planWarnings, plant.id);

                  return (
                    <button
                      aria-label={`${plant.label || `Plant ${index + 1}`} at X: ${formatFeet(
                        plant.xFt,
                      )} ft, Y: ${formatFeet(plant.yFt)} ft`}
                      className={`${styles.plant} ${
                        styles[plant.mode] ?? ''
                      } ${isSelected ? styles.selectedPlant : ''} ${
                        isDragging ? styles.draggingPlant : ''
                      } ${hasWarning ? styles.warningItem : ''}`}
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
                      style={footprintStyle(footprint)}
                      type="button"
                    >
                      <PlantIcon title="" />
                      <span>{plant.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <Inspector
          garden={activeGarden}
          onResizeStructure={resizeStructure}
          onUpdateStructureShade={updateStructureShade}
          selectedItem={selectedItem}
          sunLayer={activeSunLayer}
          sunSeason={sunSeason}
          warnings={planWarnings}
        />
      </div>

      {isPlotSettingsOpen ? (
        <PlotSettingsModal
          onApply={(widthFt, depthFt, orientationDegrees, location) => {
            applyPlotSettings(widthFt, depthFt, orientationDegrees, location);
            setIsPlotSettingsOpen(false);
          }}
          geocodingApiKey={environment.geocodingApiKey}
          onClose={() => setIsPlotSettingsOpen(false)}
          plot={activeGarden.plot}
        />
      ) : null}

      {isAddPlantOpen ? (
        <AddPlantModal
          onAddPlant={(request) => {
            addPlant(request);
            setIsAddPlantOpen(false);
          }}
          onClose={() => setIsAddPlantOpen(false)}
          sunExposureAtPlacement={nextPlacementSunArea?.exposure ?? null}
          sunSeason={sunSeason}
        />
      ) : null}
    </section>
  );
}

function OperationsPanel({
  garden,
  isOffline,
  isLoading,
  onRefresh,
  refreshError,
}: {
  garden: Garden;
  isOffline: boolean;
  isLoading: boolean;
  onRefresh(): void;
  refreshError: string | null;
}) {
  const latestSnapshot = getLatestWeatherSnapshot(garden.weatherSnapshots);
  const activeRecommendations = garden.waterRecommendations.filter(
    (recommendation) =>
      recommendation.status === 'active' ||
      recommendation.status === 'new' ||
      recommendation.status === 'suppressed',
  );
  const todayRecommendations = activeRecommendations.filter(
    (recommendation) =>
      recommendation.recommendationDate === latestSnapshot?.observedForDate,
  );
  const visibleRecommendations =
    todayRecommendations.length > 0
      ? todayRecommendations
      : activeRecommendations.slice(0, 3);
  const inAppNotifications = [...garden.notificationLogs]
    .filter((log) => log.channel === 'inApp')
    .sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso))
    .slice(0, 3);

  return (
    <section className={styles.operationsPanel} aria-label="Garden operations">
      <div className={styles.operationsHeader}>
        <div>
          <span className={styles.statusLabel}>Garden operations</span>
          <h2>Weather and watering</h2>
        </div>
        <button
          className={styles.secondaryButton}
          disabled={isLoading || isOffline}
          onClick={onRefresh}
          type="button"
        >
          {isLoading ? 'Updating...' : isOffline ? 'Offline' : 'Update weather'}
        </button>
      </div>
      <div className={styles.operationsGrid}>
        <OperationMetric
          label="Current weather"
          value={formatWeatherSummary(latestSnapshot)}
        />
        <OperationMetric
          label="Next rain"
          value={formatNextRain(latestSnapshot)}
        />
        <OperationMetric label="Alerts" value={formatAlerts(latestSnapshot)} />
        <OperationMetric
          label="Watering"
          value={formatWateringSummary(activeRecommendations)}
        />
      </div>
      {visibleRecommendations.length > 0 ? (
        <ul className={styles.recommendationList}>
          {visibleRecommendations.slice(0, 4).map((recommendation) => (
            <li key={recommendation.id}>
              <strong>
                {recommendation.targetLabel}:{' '}
                {formatRecommendationAmount(recommendation)}
              </strong>
              <span>
                {formatUrgency(recommendation.urgency)} -{' '}
                {recommendation.reason}
              </span>
              {recommendation.rationale.length > 1 ? (
                <ul className={styles.recommendationReasons}>
                  {recommendation.rationale.slice(1, 4).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.helpText}>
          No active watering recommendations. Update weather to refresh the
          garden model.
        </p>
      )}
      {refreshError ? (
        <p className={styles.error} role="alert">
          {refreshError}
        </p>
      ) : null}
      {inAppNotifications.length > 0 ? (
        <div className={styles.inAppNotifications}>
          <span className={styles.statusLabel}>In-app notifications</span>
          <ul>
            {inAppNotifications.map((log) => (
              <li key={log.id}>{log.body || log.messageSummary}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function OperationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.operationMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Inspector({
  garden,
  onResizeStructure,
  onUpdateStructureShade,
  selectedItem,
  sunLayer,
  sunSeason,
  warnings,
}: {
  garden: Garden;
  onResizeStructure(id: string, widthFt: number, depthFt: number): void;
  onUpdateStructureShade(
    id: string,
    values: { canopyRadiusFt?: number | null; heightFt?: number | null },
  ): void;
  selectedItem: SelectedGardenItem | null;
  sunLayer: ReturnType<typeof findSunShadeLayer>;
  sunSeason: SunSeason;
  warnings: PlanWarning[];
}) {
  const selectedPlant =
    selectedItem?.type === 'planting'
      ? (garden.plantings.find((plant) => plant.id === selectedItem.id) ?? null)
      : null;
  const selectedStructure =
    selectedItem?.type === 'structure'
      ? (garden.structures.find(
          (structure) => structure.id === selectedItem.id,
        ) ?? null)
      : null;

  if (selectedPlant) {
    const crop = getCropById(selectedPlant.cropId);
    const footprint = getPlantingFootprint(selectedPlant);
    const itemWarnings = warnings.filter((warning) =>
      warning.itemIds.includes(selectedPlant.id),
    );
    const sunArea = getSunAreaAtPoint(sunLayer, selectedPlant);
    const sunMet = cropSunRequirementMet(
      selectedPlant.sunRequirement,
      sunArea?.exposure ?? null,
    );

    return (
      <aside className={styles.inspector} aria-label="Selected item inspector">
        <div>
          <span className={styles.statusLabel}>Planting</span>
          <h2>{crop?.commonName ?? selectedPlant.label}</h2>
          <p>{formatMode(selectedPlant.mode)}</p>
        </div>
        <InspectorGrid
          rows={[
            [
              'Position',
              `X ${formatFeet(selectedPlant.xFt)} ft, Y ${formatFeet(selectedPlant.yFt)} ft`,
            ],
            ['Footprint', describeFootprint(footprint)],
            ['Spacing', formatNullableInches(selectedPlant.spacingInches)],
            [
              'Water',
              formatNullableInches(selectedPlant.weeklyWaterNeedInches),
            ],
            ['Sun', formatSun(selectedPlant.sunRequirement)],
            [
              `${formatSeason(sunSeason)} sun`,
              sunArea
                ? `${sunArea.sunHours.toFixed(1)} hr, ${formatSun(
                    sunArea.exposure,
                  )}`
                : '-',
            ],
            ['Height', formatNullableInches(selectedPlant.matureHeightInches)],
          ]}
        />
        {!sunMet && sunArea ? (
          <p className={styles.warningText}>
            {crop?.commonName ?? selectedPlant.label} prefers{' '}
            {formatSun(selectedPlant.sunRequirement)}; this location is{' '}
            {formatSun(sunArea.exposure)}.
          </p>
        ) : null}
        <WarningList warnings={itemWarnings} />
      </aside>
    );
  }

  if (selectedStructure) {
    const footprint = getStructureFootprint(selectedStructure);
    const itemWarnings = warnings.filter((warning) =>
      warning.itemIds.includes(selectedStructure.id),
    );

    return (
      <aside className={styles.inspector} aria-label="Selected item inspector">
        <div>
          <span className={styles.statusLabel}>Structure</span>
          <h2>{selectedStructure.label}</h2>
          <p>{formatStructureType(selectedStructure.type)}</p>
        </div>
        <InspectorGrid
          rows={[
            [
              'Position',
              `X ${formatFeet(selectedStructure.xFt)} ft, Y ${formatFeet(selectedStructure.yFt)} ft`,
            ],
            ['Footprint', describeFootprint(footprint)],
          ]}
        />
        <div className={styles.structureSizeControls}>
          <label className={styles.field}>
            <span>Width feet</span>
            <input
              inputMode="decimal"
              min="0.25"
              onChange={(event) =>
                onResizeStructure(
                  selectedStructure.id,
                  Number(event.currentTarget.value),
                  selectedStructure.depthFt,
                )
              }
              step="0.5"
              type="number"
              value={selectedStructure.widthFt}
            />
          </label>
          <label className={styles.field}>
            <span>Depth feet</span>
            <input
              inputMode="decimal"
              min="0.25"
              onChange={(event) =>
                onResizeStructure(
                  selectedStructure.id,
                  selectedStructure.widthFt,
                  Number(event.currentTarget.value),
                )
              }
              step="0.5"
              type="number"
              value={selectedStructure.depthFt}
            />
          </label>
          <label className={styles.field}>
            <span>Height feet</span>
            <input
              inputMode="decimal"
              min="0"
              onChange={(event) =>
                onUpdateStructureShade(selectedStructure.id, {
                  heightFt: readOptionalNumber(event.currentTarget.value),
                })
              }
              step="0.5"
              type="number"
              value={selectedStructure.heightFt ?? ''}
            />
          </label>
          {selectedStructure.type === 'treeObstacle' ? (
            <label className={styles.field}>
              <span>Canopy radius feet</span>
              <input
                inputMode="decimal"
                min="0"
                onChange={(event) =>
                  onUpdateStructureShade(selectedStructure.id, {
                    canopyRadiusFt: readOptionalNumber(
                      event.currentTarget.value,
                    ),
                  })
                }
                step="0.5"
                type="number"
                value={selectedStructure.canopyRadiusFt ?? ''}
              />
            </label>
          ) : null}
        </div>
        <WarningList warnings={itemWarnings} />
      </aside>
    );
  }

  return (
    <aside className={styles.inspector} aria-label="Selected item inspector">
      <div>
        <span className={styles.statusLabel}>Inspector</span>
        <h2>No selection</h2>
        <p>Select a planting or structure on the plot.</p>
      </div>
      <WarningList warnings={warnings.slice(0, 4)} />
    </aside>
  );
}

function InspectorGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className={styles.inspectorGrid}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function WarningList({ warnings }: { warnings: PlanWarning[] }) {
  if (warnings.length === 0) {
    return <p className={styles.saved}>No warnings for this item.</p>;
  }

  return (
    <ul className={styles.warningList}>
      {warnings.map((warning) => (
        <li key={warning.id}>{warning.message}</li>
      ))}
    </ul>
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

function footprintStyle(rect: FootRect): CSSProperties {
  return {
    height: `${rect.depthFt * pixelsPerFoot}px`,
    left: `${rect.xFt * pixelsPerFoot}px`,
    top: `${rect.yFt * pixelsPerFoot}px`,
    width: `${rect.widthFt * pixelsPerFoot}px`,
  };
}

function sunAreaStyle(area: SunShadeArea): CSSProperties {
  return {
    height: `${area.depthFt * pixelsPerFoot}px`,
    left: `${area.xFt * pixelsPerFoot}px`,
    top: `${area.yFt * pixelsPerFoot}px`,
    width: `${area.widthFt * pixelsPerFoot}px`,
  };
}

function markDragMoved(event: PointerEvent<HTMLElement>, dragState: DragState) {
  const hasMoved =
    Math.abs(event.clientX - dragState.startClientX) > 3 ||
    Math.abs(event.clientY - dragState.startClientY) > 3;

  if (!hasMoved && !dragState.moved) {
    return false;
  }

  dragState.moved = true;
  return true;
}

function releasePointerCapture(event: PointerEvent<HTMLElement>) {
  if (
    typeof event.currentTarget.hasPointerCapture === 'function' &&
    event.currentTarget.hasPointerCapture(event.pointerId)
  ) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

function formatNullableInches(value: number | null) {
  return value === null ? '-' : `${value} in`;
}

function readOptionalNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMode(mode: Planting['mode']) {
  return mode
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatSun(value: Planting['sunRequirement']) {
  return value
    ? value
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (letter) => letter.toUpperCase())
    : '-';
}

function formatStructureType(type: StructureType) {
  return type
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function getLatestWeatherSnapshot(snapshots: WeatherSnapshot[]) {
  return [...snapshots].sort((left, right) =>
    right.capturedAtIso.localeCompare(left.capturedAtIso),
  )[0];
}

function formatWeatherSummary(snapshot: WeatherSnapshot | undefined) {
  if (!snapshot) {
    return 'Not updated';
  }

  const temperature =
    snapshot.temperatureF === null
      ? ''
      : `, ${Math.round(snapshot.temperatureF)}F`;

  return `${snapshot.conditionSummary || 'Observed'}${temperature}`;
}

function formatNextRain(snapshot: WeatherSnapshot | undefined) {
  if (!snapshot) {
    return 'Unknown';
  }

  if (!snapshot.nextRainIso) {
    return `${formatNullableInches(snapshot.forecastRainNext24In)} next 24h`;
  }

  return `${formatNullableInches(snapshot.forecastRainNext24In)} by ${formatShortDateTime(
    snapshot.nextRainIso,
  )}`;
}

function formatAlerts(snapshot: WeatherSnapshot | undefined) {
  if (!snapshot || snapshot.alertSummaries.length === 0) {
    return 'None active';
  }

  return (
    snapshot.alertSummaries[0] ?? `${snapshot.alertSummaries.length} alerts`
  );
}

function formatWateringSummary(recommendations: WaterRecommendation[]) {
  const activeCount = recommendations.filter(
    (recommendation) => recommendation.status !== 'suppressed',
  ).length;
  const suppressedCount = recommendations.length - activeCount;

  if (activeCount > 0) {
    return `${activeCount} today`;
  }

  return suppressedCount > 0 ? `${suppressedCount} after rain` : 'None today';
}

function formatRecommendationAmount(recommendation: WaterRecommendation) {
  if (recommendation.status === 'suppressed') {
    return `wait until ${formatShortDateTime(recommendation.suppressUntilIso)}`;
  }

  return `${recommendation.recommendedWaterInches.toFixed(2)} in`;
}

function formatUrgency(urgency: WaterRecommendation['urgency']) {
  return urgency
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatShortDateTime(value: string | null) {
  if (!value) {
    return 'later';
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function formatSeason(season: SunSeason) {
  return season.replace(/^./, (letter) => letter.toUpperCase());
}
