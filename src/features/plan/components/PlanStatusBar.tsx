import type {
  Garden,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import { getSaveFeedback } from '../../../shared/sync/syncFeedback';
import { formatFeet } from '../../garden/gardenMath';
import {
  getPlanWarningTaxonomy,
  type PlanWarning,
} from '../../garden/gardenPlanning';
import { sunSeasons, type SunSeason } from '../../garden/sunShadeEngine';
import styles from './PlanStatusBar.module.css';

export function PlanStatusBar({
  dirty,
  garden,
  isOffline,
  manualSunEdit,
  manualSunExposure,
  planWarnings,
  saveStatus,
  selectedPlantId,
  selectedStructureId,
  setManualSunEdit,
  setManualSunExposure,
  setShowSunOverlay,
  setSunSeason,
  showSunOverlay,
  sunSeason,
}: {
  dirty: boolean;
  garden: Garden;
  isOffline: boolean;
  manualSunEdit: boolean;
  manualSunExposure: SunExposure;
  planWarnings: PlanWarning[];
  saveStatus: 'error' | 'idle' | 'queued' | 'saved' | 'saving';
  selectedPlantId: string | null;
  selectedStructureId: string | null;
  setManualSunEdit(value: boolean): void;
  setManualSunExposure(value: SunExposure): void;
  setShowSunOverlay(value: boolean): void;
  setSunSeason(value: SunSeason): void;
  showSunOverlay: boolean;
  sunSeason: SunSeason;
}) {
  const selectedPlant =
    garden.plantings.find((plant) => plant.id === selectedPlantId) ?? null;
  const selectedStructure =
    garden.structures.find(
      (structure) => structure.id === selectedStructureId,
    ) ?? null;
  const mustFixCount = planWarnings.filter(
    (warning) => getPlanWarningTaxonomy(warning) === 'mustFix',
  ).length;
  const recommendedCount = planWarnings.filter(
    (warning) => getPlanWarningTaxonomy(warning) === 'recommendedImprovement',
  ).length;
  const saveFeedback = getSaveFeedback({
    hasUnsavedChanges: dirty,
    isOffline,
    status: saveStatus,
    surface: 'plan',
  });

  return (
    <div className={styles.statusRow}>
      <div>
        <span className={styles.kicker}>Selection</span>
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
        {mustFixCount > 0 ? (
          <p className={styles.warningText} role="status">
            {mustFixCount} must-fix issue{mustFixCount === 1 ? '' : 's'}
          </p>
        ) : recommendedCount > 0 ? (
          <p className={styles.reviewText} role="status">
            {recommendedCount} planning note
            {recommendedCount === 1 ? '' : 's'} in Review
          </p>
        ) : (
          <p className={styles.saved}>Plan checks quiet</p>
        )}
      </div>
      <div className={styles.sunControls}>
        <label>
          <input
            checked={showSunOverlay}
            onChange={(event) => setShowSunOverlay(event.currentTarget.checked)}
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
            onChange={(event) => setManualSunEdit(event.currentTarget.checked)}
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
      <div className={styles.saveState} aria-live="polite" role="status">
        {saveFeedback.shouldRender ? (
          <>
            <p
              className={
                saveFeedback.tone === 'success'
                  ? styles.saved
                  : saveFeedback.tone === 'danger'
                    ? styles.error
                    : styles.queued
              }
            >
              {saveFeedback.label}
            </p>
            {saveFeedback.detail ? <small>{saveFeedback.detail}</small> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
