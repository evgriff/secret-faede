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
  onRecalculateSun,
  onRejectReviewSuggestion,
  onRestoreWarning,
  onSnoozeReviewSuggestion,
  planHealthReport,
  reviewSuggestions,
  setManualSunEdit,
  setManualSunExposure,
  setAccessiblePathDefaults,
  setMode,
  setShowSunOverlay,
  setSunSeason,
  setStructureType,
  showSunOverlay,
  sunSeason,
  structureType,
  suggestionDecisions,
}: {
  accessiblePathDefaults: boolean;
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
  onRecalculateSun(): void;
  onRejectReviewSuggestion(suggestion: ReviewSuggestion): void;
  onRestoreWarning(warningId: string): void;
  onSnoozeReviewSuggestion(suggestion: ReviewSuggestion): void;
  planHealthReport: PlanHealthReport;
  reviewSuggestions: ReviewSuggestion[];
  setManualSunEdit(value: boolean): void;
  setManualSunExposure(value: SunExposure): void;
  setAccessiblePathDefaults(value: boolean): void;
  setMode(mode: PlanMode): void;
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
      <div className={styles.mobileModeStrip} aria-label="Plan modes">
        {planModes.map((entry) => (
          <button
            aria-pressed={mode === entry.mode}
            className={`${styles.modePill} ${
              mode === entry.mode ? styles.activePill : ''
            }`}
            key={entry.mode}
            onClick={() => setMode(entry.mode)}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </div>

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
              onAcceptBatch={onAcceptReviewBatch}
              onAcceptSuggestion={onAcceptReviewSuggestion}
              onGenerateAutoLayoutCandidates={onGenerateAutoLayoutCandidates}
              onJumpToSuggestion={onJumpToSuggestion}
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
      return 'Build the garden frame';
    case 'sun':
      return 'Model and correct exposure';
  }
}

function getDrawerCopy(mode: PlanMode) {
  return planModes.find((entry) => entry.mode === mode)?.description ?? '';
}

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
  { label: 'Hose bib / utility', type: 'hoseBib' },
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
  const isPath = structureType === 'path' || structureType === 'pathway';

  return (
    <div className={styles.structureControls}>
      <label>
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
        Place structure
      </button>
    </div>
  );
}
