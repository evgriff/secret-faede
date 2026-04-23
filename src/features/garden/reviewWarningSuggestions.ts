import type {
  Garden,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import type { PlanWarning } from './gardenPlanning';
import {
  buildAddAccessPathSuggestion,
  buildClearPathSuggestion,
} from './reviewAccessSuggestions';
import {
  buildShadeConflictSuggestion,
  buildReassignCropSuggestion,
  buildSplitSuggestion,
  buildSunMoveSuggestion,
  createFlagSuggestion,
} from './reviewMovementSuggestions';
import {
  buildSupportSuggestion,
  buildTrellisedLayoutSuggestion,
  buildWidenPathSuggestion,
} from './reviewSupportSuggestions';
import { compact, type ReviewSuggestion } from './reviewSuggestionModel';

export function buildWarningSuggestions(
  garden: Garden,
  warning: PlanWarning,
  sunLayer: SunShadeLayer | null,
): ReviewSuggestion[] {
  switch (warning.kind) {
    case 'bedFit':
    case 'container':
      return compact([buildReassignCropSuggestion(garden, warning)]);
    case 'pathway': {
      const widenPath = buildWidenPathSuggestion(garden, warning);

      return widenPath
        ? [widenPath]
        : compact([
            buildClearPathSuggestion(garden, warning),
            buildAddAccessPathSuggestion(garden, warning),
            createFlagSuggestion(garden, warning),
          ]);
    }
    case 'rotation':
      return compact([
        createFlagSuggestion(garden, warning, 'flagRotationConcern'),
      ]);
    case 'shade':
      return compact([
        buildShadeConflictSuggestion(garden, warning),
        createFlagSuggestion(garden, warning, 'flagSunMismatch'),
      ]);
    case 'spacing':
      return compact([buildSplitSuggestion(garden, warning)]);
    case 'sun': {
      const sunMove = buildSunMoveSuggestion(garden, warning, sunLayer);

      return sunMove
        ? [sunMove]
        : compact([createFlagSuggestion(garden, warning, 'flagSunMismatch')]);
    }
    case 'trellis':
      return compact([
        buildSupportSuggestion(garden, warning),
        buildTrellisedLayoutSuggestion(garden, warning),
      ]);
    case 'bounds':
    case 'structure':
      return compact([createFlagSuggestion(garden, warning)]);
  }
}
