import { useEffect } from 'react';

import type {
  AuthorableStructureType,
  LayoutProblem,
  LayoutResolutionOption,
  StructureType,
  SunExposure,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import type {
  PlanHealthIssue,
  PlanHealthReport,
} from '../../garden/planHealthRules';
import type { SunSeason } from '../../garden/sunShadeEngine';
import type { LayoutProblemResolutionModel } from '../layoutProblemResolution';
import { getPlanModeLabel, planModes, type PlanMode } from '../planModes';
import { PlanHealthPanel } from './PlanHealthPanel';
import { PlanReviewPanel } from './PlanReviewPanel';
import { PlanSunControls } from './PlanSunControls';
import styles from './PlanModeDrawer.module.css';

export function PlanModeDrawer({
  accessiblePathDefaults,
  activeProblemId,
  activeSunLayer,
  manualSunEdit,
  manualSunExposure,
  mode,
  onAddPlant,
  onAddStructure,
  onApplyResolutionOption,
  onClose,
  onGenerateAutoLayoutCandidates,
  onDismissHealthIssue,
  onIgnoreProblem,
  onJumpToHealthIssue,
  onJumpToProblem,
  onPreviewResolutionOption,
  onRecalculateSun,
  onRestoreWarning,
  onSelectProblem,
  layoutProblemResolutionModel,
  planHealthReport,
  setManualSunEdit,
  setManualSunExposure,
  setAccessiblePathDefaults,
  setShowSunOverlay,
  setSunSeason,
  setStructureType,
  showSunOverlay,
  sunSeason,
  structureType,
}: {
  accessiblePathDefaults: boolean;
  activeProblemId: string | null;
  activeSunLayer: SunShadeLayer;
  layoutProblemResolutionModel: LayoutProblemResolutionModel;
  manualSunEdit: boolean;
  manualSunExposure: SunExposure;
  mode: PlanMode;
  onAddPlant(): void;
  onAddStructure(): void;
  onApplyResolutionOption(option: LayoutResolutionOption): void;
  onClose(): void;
  onDismissHealthIssue(issue: PlanHealthIssue): void;
  onGenerateAutoLayoutCandidates(): void;
  onIgnoreProblem(problem: LayoutProblem): void;
  onJumpToHealthIssue(issue: PlanHealthIssue): void;
  onJumpToProblem(problem: LayoutProblem): void;
  onPreviewResolutionOption(option: LayoutResolutionOption): void;
  onRecalculateSun(): void;
  onRestoreWarning(warningId: string): void;
  onSelectProblem(problemId: string | null): void;
  planHealthReport: PlanHealthReport;
  setManualSunEdit(value: boolean): void;
  setManualSunExposure(value: SunExposure): void;
  setAccessiblePathDefaults(value: boolean): void;
  setShowSunOverlay(value: boolean): void;
  setSunSeason(value: SunSeason): void;
  setStructureType(type: AuthorableStructureType): void;
  showSunOverlay: boolean;
  sunSeason: SunSeason;
  structureType: StructureType;
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
        {mode === 'optimize' ? (
          <>
            <PlanReviewPanel
              activeProblemId={activeProblemId}
              layoutModel={layoutProblemResolutionModel}
              onApplyResolutionOption={onApplyResolutionOption}
              onGenerateVariants={onGenerateAutoLayoutCandidates}
              onIgnoreProblem={onIgnoreProblem}
              onJumpToProblem={onJumpToProblem}
              onPreviewResolutionOption={onPreviewResolutionOption}
              onSelectProblem={onSelectProblem}
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
    case 'optimize':
      return 'Problem inbox and variants';
    case 'plant':
      return 'Place plants manually';
    case 'select':
      return 'Detailed view';
    case 'structure':
      return 'Beds, paths, and trellises';
    case 'sun':
      return 'Review sun and shade';
  }
}

function getDrawerCopy(mode: PlanMode) {
  return planModes.find((entry) => entry.mode === mode)?.description ?? '';
}

const primaryStructureOptions: Array<{
  label: string;
  type: AuthorableStructureType;
}> = [
  { label: 'Raised bed', type: 'raisedBed' },
  { label: 'In-ground bed', type: 'inGroundBed' },
  { label: 'Container', type: 'container' },
  { label: 'Access path', type: 'pathway' },
  { label: 'Trellis', type: 'trellis' },
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
  setStructureType(type: AuthorableStructureType): void;
  structureType: StructureType;
}) {
  const selectedStructureType = isPrimaryStructureType(structureType)
    ? structureType
    : 'raisedBed';
  const isPath = selectedStructureType === 'pathway';

  useEffect(() => {
    if (structureType !== selectedStructureType) {
      setStructureType(selectedStructureType);
    }
  }, [selectedStructureType, setStructureType, structureType]);

  return (
    <div className={styles.structureControls}>
      <label>
        <span>Plot structure</span>
        <select
          aria-label="Plot structure type"
          onChange={(event) =>
            setStructureType(
              event.currentTarget.value as AuthorableStructureType,
            )
          }
          value={selectedStructureType}
        >
          {primaryStructureOptions.map((option) => (
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

function isPrimaryStructureType(
  type: StructureType,
): type is AuthorableStructureType {
  return primaryStructureOptions.some((option) => option.type === type);
}
