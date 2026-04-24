import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  ClimateProfile,
  DetailedViewState,
  Garden,
  GardenLocation,
  LayoutProblem,
  LayoutResolution,
  LayoutResolutionOption,
  PlantEditorModalState,
  PlantGroup,
  SunExposure,
} from '../../domain/gardens/GardenRepository';
import {
  createPlantGroupFromPlanting,
  toPlantSpecies,
} from '../../domain/gardens/GardenRepository';

export const GARDEN_PLANNING_STATE_VERSION = 2;

export type PlantLabelVisibilityMode = 'auto' | 'hidden' | 'visible';

export interface PlantLabelVisibilityState {
  groupIds: string[];
  mode: PlantLabelVisibilityMode;
}

export interface PlantLocationMatchState {
  climateProfile: ClimateProfile;
  defaultLocation: GardenLocation;
  source: 'gardenProfile' | 'storedFallback';
  sunExposureAtPlacement: SunExposure | null;
  updatedAtIso: string | null;
}

export interface PlantLayoutReviewState {
  problems: LayoutProblem[];
  resolutionOptions: LayoutResolutionOption[];
  resolutions: LayoutResolution[];
  selectedProblemId: string | null;
}

export interface GardenPlanningState {
  detailedView: DetailedViewState;
  editor: PlantEditorModalState;
  hoveredPlantGroupId: string | null;
  labelVisibility: PlantLabelVisibilityState;
  layout: PlantLayoutReviewState;
  locationMatch: PlantLocationMatchState;
  plantGroups: PlantGroup[];
  schemaVersion: typeof GARDEN_PLANNING_STATE_VERSION;
  selectedPlantGroupId: string | null;
}

export interface GardenPlanningHydration {
  migrations: string[];
  state: GardenPlanningState;
}

export const closedPlantEditorState: PlantEditorModalState = {
  dotId: null,
  groupId: null,
  isOpen: false,
  problemId: null,
  source: null,
  tab: 'summary',
};

export const closedDetailedViewState: DetailedViewState = {
  isOpen: false,
  presentation: 'sidePanel',
  subject: null,
};

export function buildPlantGroups(garden: Garden): PlantGroup[] {
  return garden.plantings.map((planting) => {
    const crop = getCropById(planting.cropId);
    const species = crop ? toPlantSpecies(crop) : undefined;

    return createPlantGroupFromPlanting(planting, species);
  });
}

export function createDefaultGardenPlanningState(
  garden: Garden,
): GardenPlanningState {
  return {
    detailedView: closedDetailedViewState,
    editor: closedPlantEditorState,
    hoveredPlantGroupId: null,
    labelVisibility: {
      groupIds: [],
      mode: 'auto',
    },
    layout: {
      problems: [],
      resolutionOptions: [],
      resolutions: [],
      selectedProblemId: null,
    },
    locationMatch: {
      climateProfile: garden.climateProfile,
      defaultLocation: garden.plot.location,
      source: 'gardenProfile',
      sunExposureAtPlacement: null,
      updatedAtIso: garden.updatedAtIso,
    },
    plantGroups: buildPlantGroups(garden),
    schemaVersion: GARDEN_PLANNING_STATE_VERSION,
    selectedPlantGroupId: null,
  };
}

export function openPlantEditor(
  groupId: string,
  source: NonNullable<PlantEditorModalState['source']>,
  options: {
    dotId?: string | null;
    problemId?: string | null;
    tab?: PlantEditorModalState['tab'];
  } = {},
): PlantEditorModalState {
  return {
    dotId: options.dotId ?? null,
    groupId,
    isOpen: true,
    problemId: options.problemId ?? null,
    source,
    tab: options.tab ?? 'summary',
  };
}

export function openPlantDetailedView(groupId: string): DetailedViewState {
  return {
    isOpen: true,
    presentation: 'modal',
    subject: {
      dotId: null,
      groupId,
      type: 'plantGroup',
    },
  };
}

export function syncGardenPlanningStateWithGarden(
  state: GardenPlanningState | null,
  garden: Garden,
): GardenPlanningState {
  const defaults = createDefaultGardenPlanningState(garden);
  const groupIds = new Set(defaults.plantGroups.map((group) => group.id));

  if (!state) {
    return defaults;
  }

  const selectedPlantGroupId = normalizeGroupId(
    state.selectedPlantGroupId,
    groupIds,
  );
  const hoveredPlantGroupId = normalizeGroupId(
    state.hoveredPlantGroupId,
    groupIds,
  );

  return {
    ...state,
    detailedView: normalizeDetailedViewState(state.detailedView, groupIds),
    editor: normalizePlantEditorState(state.editor, groupIds),
    hoveredPlantGroupId,
    labelVisibility: {
      ...state.labelVisibility,
      groupIds: state.labelVisibility.groupIds.filter((id) => groupIds.has(id)),
    },
    locationMatch: {
      ...state.locationMatch,
      climateProfile: garden.climateProfile,
      defaultLocation: garden.plot.location,
      source: 'gardenProfile',
      updatedAtIso: garden.updatedAtIso,
    },
    plantGroups: defaults.plantGroups,
    selectedPlantGroupId,
  };
}

function normalizePlantEditorState(
  state: PlantEditorModalState,
  groupIds: Set<string>,
): PlantEditorModalState {
  if (!state.isOpen || !state.groupId || !groupIds.has(state.groupId)) {
    return closedPlantEditorState;
  }

  return state;
}

function normalizeDetailedViewState(
  state: DetailedViewState,
  groupIds: Set<string>,
): DetailedViewState {
  if (!state.isOpen || state.subject?.type !== 'plantGroup') {
    return state;
  }

  return groupIds.has(state.subject.groupId) ? state : closedDetailedViewState;
}

function normalizeGroupId(value: string | null, groupIds: Set<string>) {
  return value && groupIds.has(value) ? value : null;
}
