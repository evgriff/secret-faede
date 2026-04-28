import type {
  DetailedViewState,
  Garden,
  LayoutResolution,
  PlantEditorEntryPoint,
  PlantEditorModalState,
  PlantEditorTab,
  SunExposure,
} from '../../domain/gardens/GardenRepository';
import {
  readJsonStorageValue,
  writeJsonStorageValue,
} from '../../shared/lib/storage';
import {
  closedDetailedViewState,
  closedPlantEditorState,
  createDefaultGardenPlanningState,
  GARDEN_PLANNING_STATE_VERSION,
  openPlantDetailedView,
  openPlantEditor,
  type GardenPlanningHydration,
  type GardenPlanningState,
  type PlantLabelVisibilityState,
  type PlantLocationMatchState,
  type PlantLayoutReviewState,
} from './gardenPlanningState';

interface StoredGardenPlanningStateV2 {
  detailedView: DetailedViewState;
  editor: PlantEditorModalState;
  labelVisibility: PlantLabelVisibilityState;
  layout: Pick<PlantLayoutReviewState, 'resolutions' | 'selectedProblemId'>;
  locationMatch: PlantLocationMatchState;
  schemaVersion: typeof GARDEN_PLANNING_STATE_VERSION;
  selectedPlantGroupId: string | null;
}

type MigratedGardenPlanningState = Partial<
  Omit<GardenPlanningState, 'layout' | 'plantGroups' | 'schemaVersion'> & {
    layout: Partial<PlantLayoutReviewState>;
    schemaVersion: typeof GARDEN_PLANNING_STATE_VERSION;
  }
>;

export function readGardenPlanningState(
  userId: string,
  garden: Garden,
): GardenPlanningHydration {
  const defaults = createDefaultGardenPlanningState(garden);
  const stored = readJsonStorageValue<unknown>(
    getGardenPlanningStateKey(userId),
  );
  const migration = migrateGardenPlanningStateRecord(stored, garden);

  return {
    migrations: migration.migrations,
    state: {
      ...defaults,
      ...migration.state,
      hoveredPlantGroupId: null,
      layout: {
        ...defaults.layout,
        ...migration.state.layout,
      },
      locationMatch: {
        ...defaults.locationMatch,
        ...migration.state.locationMatch,
        source: migration.state.locationMatch?.source ?? 'gardenProfile',
      },
      plantGroups: defaults.plantGroups,
    },
  };
}

export function writeGardenPlanningState(
  userId: string,
  state: GardenPlanningState,
): void {
  writeJsonStorageValue(
    getGardenPlanningStateKey(userId),
    toStoredState(state),
  );
}

export function getGardenPlanningStorageSignature(
  state: GardenPlanningState,
): string {
  return JSON.stringify(toStoredState(state));
}

export function migrateGardenPlanningStateRecord(
  value: unknown,
  garden: Garden,
): {
  migrations: string[];
  state: MigratedGardenPlanningState;
} {
  if (!isRecord(value)) {
    return { migrations: [], state: {} };
  }

  const groupIds = new Set(garden.plantings.map((planting) => planting.id));
  const migrations: string[] = [];

  for (const key of ['markerLayer', 'markers', 'plantNodes', 'plants']) {
    if (key in value) {
      migrations.push(`dropped legacy ${key}`);
    }
  }

  if (value.schemaVersion === GARDEN_PLANNING_STATE_VERSION) {
    return {
      migrations,
      state: parseStoredV2State(value, garden, groupIds),
    };
  }

  migrations.push('migrated plan workspace state to v2');
  return {
    migrations,
    state: parseLegacyState(value, garden, groupIds),
  };
}

function parseStoredV2State(
  value: Record<string, unknown>,
  garden: Garden,
  groupIds: Set<string>,
): MigratedGardenPlanningState {
  const layout = isRecord(value.layout) ? value.layout : {};

  return {
    detailedView: parseDetailedViewState(value.detailedView, groupIds),
    editor: parsePlantEditorState(value.editor, groupIds),
    labelVisibility: parseLabelVisibility(value.labelVisibility, groupIds),
    layout: {
      resolutions: parseLayoutResolutions(layout.resolutions),
      selectedProblemId: readNullableString(layout.selectedProblemId),
    },
    locationMatch: parseLocationMatchState(value.locationMatch, garden),
    schemaVersion: GARDEN_PLANNING_STATE_VERSION,
    selectedPlantGroupId: normalizeGroupId(
      value.selectedPlantGroupId,
      groupIds,
    ),
  };
}

function parseLegacyState(
  value: Record<string, unknown>,
  garden: Garden,
  groupIds: Set<string>,
): MigratedGardenPlanningState {
  const selectedPlantGroupId = normalizeGroupId(
    value.selectedPlantGroupId ??
      value.selectedPlantId ??
      value.selectedPlantingId,
    groupIds,
  );
  const editorGroupId = normalizeGroupId(
    value.editorPlantGroupId ??
      value.wrenchPlantId ??
      value.activeEditorPlantId,
    groupIds,
  );

  return {
    detailedView:
      value.detailedViewOpen === true && selectedPlantGroupId
        ? openPlantDetailedView(selectedPlantGroupId)
        : closedDetailedViewState,
    editor:
      value.editorOpen === true && editorGroupId
        ? openPlantEditor(editorGroupId, 'detailedView')
        : closedPlantEditorState,
    labelVisibility: parseLabelVisibility(value.labelVisibility, groupIds),
    layout: {
      resolutions: [],
      selectedProblemId: readNullableString(value.selectedProblemId),
    },
    locationMatch: parseLocationMatchState(value.locationMatch, garden),
    schemaVersion: GARDEN_PLANNING_STATE_VERSION,
    selectedPlantGroupId,
  };
}

function toStoredState(
  state: GardenPlanningState,
): StoredGardenPlanningStateV2 {
  return {
    detailedView: state.detailedView,
    editor: state.editor,
    labelVisibility: state.labelVisibility,
    layout: {
      resolutions: state.layout.resolutions,
      selectedProblemId: state.layout.selectedProblemId,
    },
    locationMatch: state.locationMatch,
    schemaVersion: GARDEN_PLANNING_STATE_VERSION,
    selectedPlantGroupId: state.selectedPlantGroupId,
  };
}

function parsePlantEditorState(
  value: unknown,
  groupIds: Set<string>,
): PlantEditorModalState {
  if (!isRecord(value) || value.isOpen !== true) {
    return closedPlantEditorState;
  }

  const groupId = normalizeGroupId(value.groupId, groupIds);

  return groupId
    ? openPlantEditor(groupId, readEditorSource(value.source), {
        dotId: readNullableString(value.dotId),
        problemId: readNullableString(value.problemId),
        tab: readEditorTab(value.tab),
      })
    : closedPlantEditorState;
}

function parseDetailedViewState(
  value: unknown,
  groupIds: Set<string>,
): DetailedViewState {
  if (!isRecord(value) || value.isOpen !== true || !isRecord(value.subject)) {
    return closedDetailedViewState;
  }

  if (value.subject.type === 'plantGroup') {
    const groupId = normalizeGroupId(value.subject.groupId, groupIds);
    return groupId ? openPlantDetailedView(groupId) : closedDetailedViewState;
  }

  return {
    isOpen: true,
    presentation: 'sidePanel',
    subject: value.subject as DetailedViewState['subject'],
  };
}

function parseLabelVisibility(
  value: unknown,
  groupIds: Set<string>,
): PlantLabelVisibilityState {
  const record = isRecord(value) ? value : {};
  const mode =
    record.mode === 'hidden' || record.mode === 'visible'
      ? record.mode
      : 'auto';

  return {
    groupIds: readStringArray(record.groupIds).filter((id) => groupIds.has(id)),
    mode,
  };
}

function parseLocationMatchState(
  value: unknown,
  garden: Garden,
): PlantLocationMatchState {
  const record = isRecord(value) ? value : {};

  return {
    climateProfile: garden.climateProfile,
    defaultLocation: garden.plot.location,
    source:
      record.source === 'storedFallback' ? 'storedFallback' : 'gardenProfile',
    sunExposureAtPlacement: readSunExposure(record.sunExposureAtPlacement),
    updatedAtIso:
      readNullableString(record.updatedAtIso) ?? garden.updatedAtIso,
  };
}

function parseLayoutResolutions(value: unknown): LayoutResolution[] {
  return Array.isArray(value)
    ? value.flatMap((entry): LayoutResolution[] => {
        if (!isRecord(entry) || typeof entry.id !== 'string') {
          return [];
        }

        return [
          {
            appliedAtIso: readNullableString(entry.appliedAtIso),
            downstreamValidation: parseLayoutDownstreamValidation(
              entry.downstreamValidation,
            ),
            id: entry.id,
            ignoredAtIso: readNullableString(entry.ignoredAtIso),
            optionId: readString(entry.optionId),
            problemId: readString(entry.problemId),
            status: readResolutionStatus(entry.status),
            variantGroupId: readNullableString(entry.variantGroupId),
          },
        ];
      })
    : [];
}

function parseLayoutDownstreamValidation(
  value: unknown,
): LayoutResolution['downstreamValidation'] {
  if (!isRecord(value)) {
    return {
      checkedAtIso: null,
      message: null,
      remainingProblemIds: [],
      status: 'notRun',
    };
  }

  return {
    checkedAtIso: readNullableString(value.checkedAtIso),
    message: readNullableString(value.message),
    remainingProblemIds: Array.isArray(value.remainingProblemIds)
      ? value.remainingProblemIds.filter(
          (problemId): problemId is string => typeof problemId === 'string',
        )
      : [],
    status:
      value.status === 'failed' ||
      value.status === 'passed' ||
      value.status === 'stale' ||
      value.status === 'warning'
        ? value.status
        : 'notRun',
  };
}

function getGardenPlanningStateKey(userId: string) {
  return `secret-faeries.plan-state.v2:${encodeURIComponent(userId)}`;
}

function normalizeGroupId(value: unknown, groupIds: Set<string>) {
  return typeof value === 'string' && groupIds.has(value) ? value : null;
}

function readEditorSource(value: unknown): PlantEditorEntryPoint {
  return value === 'addPlants' ||
    value === 'cropFocus' ||
    value === 'problemResolution' ||
    value === 'wrench'
    ? value
    : 'detailedView';
}

function readEditorTab(value: unknown): PlantEditorTab {
  return value === 'care' ||
    value === 'photos' ||
    value === 'placement' ||
    value === 'problems'
    ? value
    : 'summary';
}

function readResolutionStatus(value: unknown): LayoutResolution['status'] {
  return value === 'applied' ||
    value === 'dismissed' ||
    value === 'ignored' ||
    value === 'rejected'
    ? value
    : 'pending';
}

function readSunExposure(value: unknown): SunExposure | null {
  return value === 'fullShade' ||
    value === 'fullSun' ||
    value === 'partShade' ||
    value === 'partSun'
    ? value
    : null;
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function readNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((entry): string[] =>
        typeof entry === 'string' && entry.trim() ? [entry] : [],
      )
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
