import { useEffect, useRef } from 'react';

import type {
  Garden,
  LayoutVariant,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import type { PlanWarning } from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import type {
  AutoLayoutCandidate,
  AutoLayoutRunStatus,
} from '../autoLayoutTypes';
import {
  getAutoLayoutButtonLabel,
  getAutoLayoutStageState,
  getVisibleAutoLayoutStages,
  isAutoLayoutBusy,
} from '../autoLayoutRunState';
import { buildSeasonCropLayoutRequests } from '../seasonCropPlan';
import { PlanOptimizeCandidates } from './PlanOptimizeCandidates';
import styles from './PlanOperationsPanel.module.css';

export function PlanOperationsPanel({
  autoLayoutSuggestion,
  currentWarnings,
  garden,
  onApplyAutoLayoutCandidate,
  onDismissAutoLayoutSuggestion,
  onGenerateAutoLayoutSuggestion,
  optimizerIncludesDraftSave,
  optimizerMessage,
  optimizerStatus,
  suggestion,
  sunLayer,
  sunSeason,
}: {
  autoLayoutSuggestion: AutoLayoutCandidate | null;
  currentWarnings: PlanWarning[];
  garden: Garden;
  onApplyAutoLayoutCandidate(): void;
  onDismissAutoLayoutSuggestion(): void;
  onGenerateAutoLayoutSuggestion(): void;
  optimizerIncludesDraftSave: boolean;
  optimizerMessage: string | null;
  optimizerStatus: AutoLayoutRunStatus;
  suggestion: LayoutVariant | null;
  sunLayer: SunShadeLayer | null;
  sunSeason: SunSeason;
}) {
  const layoutRequests = buildSeasonCropLayoutRequests(garden);
  const requestedPlantCount = layoutRequests.reduce(
    (total, request) => total + request.quantity,
    0,
  );
  const hasSuggestion = Boolean(autoLayoutSuggestion && suggestion);
  const isOptimizing = isAutoLayoutBusy(optimizerStatus);
  const layoutSectionRef = useRef<HTMLElement>(null);
  const progressStages = getVisibleAutoLayoutStages(optimizerIncludesDraftSave);

  useEffect(() => {
    if (!hasSuggestion) {
      return;
    }

    layoutSectionRef.current?.scrollIntoView?.({ block: 'start' });
  }, [autoLayoutSuggestion?.id, hasSuggestion]);

  return (
    <section className={styles.panel} aria-label="Layout suggestion workflow">
      <section
        className={styles.materials}
        aria-label="Layout suggestion"
        ref={layoutSectionRef}
      >
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.kicker}>Layout suggestion</span>
            <h3>Try a different arrangement</h3>
            <p className={styles.helpText}>
              Use this when you want one checked whole-plot suggestion for the
              crops already saved to the plan.
            </p>
          </div>
          <button
            className={styles.secondaryButton}
            disabled={layoutRequests.length === 0 || isOptimizing}
            onClick={onGenerateAutoLayoutSuggestion}
            type="button"
          >
            {getAutoLayoutButtonLabel(optimizerStatus, hasSuggestion)}
          </button>
        </div>
        {optimizerMessage ? (
          <p
            className={
              optimizerStatus === 'error' ? styles.error : styles.statusText
            }
            role={optimizerStatus === 'error' ? 'alert' : 'status'}
          >
            {optimizerMessage}
          </p>
        ) : null}
        {isOptimizing ? (
          <div className={styles.progressCard} role="status">
            <p className={styles.progressIntro}>
              Saving and checking one whole-plot suggestion. The plot will stay
              put while this runs.
            </p>
            <ol className={styles.progressList}>
              {progressStages.map((stage) => (
                <li
                  className={styles.progressItem}
                  data-state={getAutoLayoutStageState(
                    optimizerStatus,
                    stage.status,
                  )}
                  key={stage.status}
                >
                  <strong>{stage.label}</strong>
                  <span>{stage.description}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {layoutRequests.length > 0 ? (
          <>
            {!isOptimizing ? (
              <p className={styles.helpText}>
                {hasSuggestion
                  ? 'Review this suggestion, then apply it or keep the current layout.'
                  : `${layoutRequests.length} saved crop request${layoutRequests.length === 1 ? '' : 's'} still need room in the plan, covering ${requestedPlantCount} plant${requestedPlantCount === 1 ? '' : 's'} total.`}
              </p>
            ) : null}
            {!hasSuggestion && !isOptimizing ? (
              <p className={styles.helpText}>
                Generate one layout suggestion when you want a simpler full-plot
                option.
              </p>
            ) : null}
            {optimizerStatus === 'noBetterLayout' ? (
              <section className={styles.resultCard}>
                <h4>Keep current plan</h4>
                <p>
                  No simpler checked arrangement looked better than the current
                  draft.
                </p>
              </section>
            ) : null}
            {autoLayoutSuggestion && suggestion ? (
              <PlanOptimizeCandidates
                autoLayoutSuggestion={autoLayoutSuggestion}
                currentWarnings={currentWarnings}
                garden={garden}
                onApplyAutoLayoutCandidate={onApplyAutoLayoutCandidate}
                onDismissAutoLayoutSuggestion={onDismissAutoLayoutSuggestion}
                suggestion={suggestion}
                sunLayer={sunLayer}
                sunSeason={sunSeason}
              />
            ) : null}
          </>
        ) : (
          <p className={styles.helpText}>
            Add plants before generating a layout suggestion.
          </p>
        )}
      </section>
    </section>
  );
}
