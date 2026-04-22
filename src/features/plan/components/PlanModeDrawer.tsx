import { useEffect } from 'react';

import type {
  Garden,
  StructureType,
  SunExposure,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import type { GardenSuggestionDecision } from '../../../domain/gardens/gardenWorkspace';
import type {
  PlanHealthIssue,
  PlanHealthReport,
} from '../../garden/planHealthRules';
import type { ReviewSuggestion } from '../../garden/reviewSuggestions';
import type { SunSeason } from '../../garden/sunShadeEngine';
import { getPlanModeLabel, planModes, type PlanMode } from '../planModes';
import { PlanHealthPanel } from './PlanHealthPanel';
import { PlanReviewPanel } from './PlanReviewPanel';
import { PlanSunControls } from './PlanSunControls';
import styles from './PlanModeDrawer.module.css';

export function PlanModeDrawer({
  accessiblePathDefaults,
  activeReviewSuggestionId,
  activeSunLayer,
  garden,
  manualSunEdit,
  manualSunExposure,
  mode,
  onAcceptReviewBatch,
  onAcceptReviewSuggestion,
  onAddPlant,
  onAddStructure,
  onClose,
  onGenerateAutoLayoutCandidates,
  onDismissHealthIssue,
  onJumpToHealthIssue,
  onJumpToSuggestion,
  onPreviewReviewSuggestion,
  onRecalculateSun,
  onRejectReviewSuggestion,
  onRestoreWarning,
  onSnoozeReviewSuggestion,
  planHealthReport,
  reviewSuggestions,
  setManualSunEdit,
  setManualSunExposure,
  setAccessiblePathDefaults,
  setShowSunOverlay,
  setSunSeason,
  setStructureType,
  showSunOverlay,
  sunSeason,
  structureType,
  suggestionDecisions,
}: {
  accessiblePathDefaults: boolean;
  activeReviewSuggestionId: string | null;
  activeSunLayer: SunShadeLayer;
  garden: Garden;
  manualSunEdit: boolean;
  manualSunExposure: SunExposure;
  mode: PlanMode;
  onAcceptReviewBatch(suggestions: ReviewSuggestion[]): void;
  onAcceptReviewSuggestion(suggestion: ReviewSuggestion): void;
  onAddPlant(): void;
  onAddStructure(): void;
  onClose(): void;
  onDismissHealthIssue(issue: PlanHealthIssue): void;
  onGenerateAutoLayoutCandidates(): void;
  onJumpToHealthIssue(issue: PlanHealthIssue): void;
  onJumpToSuggestion(suggestion: ReviewSuggestion): void;
  onPreviewReviewSuggestion(suggestion: ReviewSuggestion): void;
  onRecalculateSun(): void;
  onRejectReviewSuggestion(suggestion: ReviewSuggestion): void;
  onRestoreWarning(warningId: string): void;
  onSnoozeReviewSuggestion(suggestion: ReviewSuggestion): void;
  planHealthReport: PlanHealthReport;
  reviewSuggestions: ReviewSuggestion[];
  setManualSunEdit(value: boolean): void;
  setManualSunExposure(value: SunExposure): void;
  setAccessiblePathDefaults(value: boolean): void;
  setShowSunOverlay(value: boolean): void;
  setSunSeason(value: SunSeason): void;
  setStructureType(type: StructureType): void;
  showSunOverlay: boolean;
  sunSeason: SunSeason;
  structureType: StructureType;
  suggestionDecisions: GardenSuggestionDecision[];
}) {
  return (
    <section className={styles.drawer} aria-label="Mode controls">
      <div className={styles.drawerBody}>
        <div className={styles.drawerHeader}>
          <div>
            <span className={styles.kicker}>{getPlanModeLabel(mode)} mode</span>
            <h2>{getDrawerTitle(mode)}</h2>
            <p>{getDrawerCopy(mode)}</p>
          </div>
          <button
            aria-label="Close mode controls"
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            X
          </button>
        </div>
        {mode === 'plant' ? (
          <button
            className={styles.primaryButton}
            onClick={onAddPlant}
            type="button"
          >
            Open plant picker
          </button>
        ) : null}
        {mode === 'structure' ? (
          <StructureControls
            accessiblePathDefaults={accessiblePathDefaults}
            onAddStructure={onAddStructure}
            setAccessiblePathDefaults={setAccessiblePathDefaults}
            setStructureType={setStructureType}
            structureType={structureType}
          />
        ) : null}
        {mode === 'sun' ? (
          <PlanSunControls
            activeSunLayer={activeSunLayer}
            manualSunEdit={manualSunEdit}
            manualSunExposure={manualSunExposure}
            onRecalculateSun={onRecalculateSun}
            setManualSunEdit={setManualSunEdit}
            setManualSunExposure={setManualSunExposure}
            setShowSunOverlay={setShowSunOverlay}
            setSunSeason={setSunSeason}
            showSunOverlay={showSunOverlay}
            sunSeason={sunSeason}
          />
        ) : null}
        {mode === 'measure' ? (
          <div className={styles.measureGrid}>
            <span>Width {garden.plot.widthFt} ft</span>
            <span>Depth {garden.plot.depthFt} ft</span>
            <span>Grid 1 ft</span>
            <span>Snap {garden.plot.snapUnitFt} ft</span>
          </div>
        ) : null}
        {mode === 'optimize' ? (
          <>
            <PlanReviewPanel
              activeSuggestionId={activeReviewSuggestionId}
              onAcceptBatch={onAcceptReviewBatch}
              onAcceptSuggestion={onAcceptReviewSuggestion}
              onGenerateAutoLayoutCandidates={onGenerateAutoLayoutCandidates}
              onJumpToSuggestion={onJumpToSuggestion}
              onPreviewSuggestion={onPreviewReviewSuggestion}
              onRejectSuggestion={onRejectReviewSuggestion}
              onSnoozeSuggestion={onSnoozeReviewSuggestion}
              reviewSuggestions={reviewSuggestions}
              suggestionDecisions={suggestionDecisions}
            />
            <PlanHealthPanel
              onDismissIssue={onDismissHealthIssue}
              onJumpToIssue={onJumpToHealthIssue}
              onRestoreIssue={(issue) => {
                if (issue.restoreWarningId) {
                  onRestoreWarning(issue.restoreWarningId);
                }
              }}
              report={planHealthReport}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

function getDrawerTitle(mode: PlanMode) {
  switch (mode) {
    case 'measure':
      return 'Scale and orientation';
    case 'optimize':
      return 'Review proposals';
    case 'plant':
      return 'Add crops deliberately';
    case 'select':
      return 'Select, drag, and inspect';
    case 'structure':
      return 'Support planting areas';
    case 'sun':
      return 'Model and correct exposure';
  }
}

function getDrawerCopy(mode: PlanMode) {
  return planModes.find((entry) => entry.mode === mode)?.description ?? '';
}

const primarySupportOptions: Array<{ label: string; type: StructureType }> = [
  { label: 'Raised bed', type: 'raisedBed' },
  { label: 'In-ground bed', type: 'inGroundBed' },
  { label: 'Container', type: 'container' },
  { label: 'Pathway', type: 'pathway' },
  { label: 'Trellis / crop support', type: 'trellis' },
];

function StructureControls({
  accessiblePathDefaults,
  onAddStructure,
  setAccessiblePathDefaults,
  setStructureType,
  structureType,
}: {
  accessiblePathDefaults: boolean;
  onAddStructure(): void;
  setAccessiblePathDefaults(value: boolean): void;
  setStructureType(type: StructureType): void;
  structureType: StructureType;
}) {
  const selectedSupportType = isPrimarySupportType(structureType)
    ? structureType
    : 'raisedBed';
  const isPath =
    selectedSupportType === 'path' || selectedSupportType === 'pathway';

  useEffect(() => {
    if (structureType !== selectedSupportType) {
      setStructureType(selectedSupportType);
    }
  }, [selectedSupportType, setStructureType, structureType]);

  return (
    <div className={styles.structureControls}>
      <label>
        <span>Garden support</span>
        <select
          aria-label="Garden support type"
          onChange={(event) =>
            setStructureType(event.currentTarget.value as StructureType)
          }
          value={selectedSupportType}
        >
          {primarySupportOptions.map((option) => (
            <option key={option.type} value={option.type}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {isPath ? (
        <label>
          <input
            checked={accessiblePathDefaults}
            onChange={(event) =>
              setAccessiblePathDefaults(event.currentTarget.checked)
            }
            type="checkbox"
          />{' '}
          Accessible path defaults
        </label>
      ) : null}
      <button
        className={styles.primaryButton}
        onClick={onAddStructure}
        type="button"
      >
        Place garden support
      </button>
    </div>
  );
}

function isPrimarySupportType(type: StructureType) {
  return primarySupportOptions.some((option) => option.type === type);
}
