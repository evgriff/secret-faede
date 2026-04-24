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
import { buildSeasonCropLayoutRequests } from '../seasonCropPlan';
import { PlanOptimizeCandidates } from './PlanOptimizeCandidates';
import styles from './PlanOperationsPanel.module.css';

export function PlanOperationsPanel({
  autoLayoutCandidates,
  currentWarnings,
  garden,
  ignoredAutoLayoutCandidateIds,
  layoutVariants,
  onApplyAutoLayoutCandidate,
  onGenerateAutoLayoutCandidates,
  onIgnoreAutoLayoutCandidate,
  onSelectAutoLayoutCandidate,
  optimizerMessage,
  optimizerStatus,
  selectedAutoLayoutCandidateId,
  sunLayer,
  sunSeason,
}: {
  autoLayoutCandidates: AutoLayoutCandidate[];
  currentWarnings: PlanWarning[];
  garden: Garden;
  ignoredAutoLayoutCandidateIds: string[];
  layoutVariants: LayoutVariant[];
  onApplyAutoLayoutCandidate(): void;
  onGenerateAutoLayoutCandidates(): void;
  onIgnoreAutoLayoutCandidate(candidateId: string): void;
  onSelectAutoLayoutCandidate(candidateId: string): void;
  optimizerMessage: string | null;
  optimizerStatus: AutoLayoutRunStatus;
  selectedAutoLayoutCandidateId: string | null;
  sunLayer: SunShadeLayer | null;
  sunSeason: SunSeason;
}) {
  const layoutRequests = buildSeasonCropLayoutRequests(garden);
  const requestedPlantCount = layoutRequests.reduce(
    (total, request) => total + request.quantity,
    0,
  );
  const hasGeneratedLayouts = autoLayoutCandidates.length > 0;
  const isOptimizing = optimizerStatus === 'running';
  const layoutSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (autoLayoutCandidates.length === 0) {
      return;
    }

    layoutSectionRef.current?.scrollIntoView?.({ block: 'start' });
  }, [autoLayoutCandidates]);

  return (
    <section className={styles.panel} aria-label="Generated layout workflow">
      <section
        className={styles.materials}
        aria-label="Generated layouts"
        ref={layoutSectionRef}
      >
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.kicker}>Layout ideas</span>
            <h3>Try a different arrangement</h3>
            <p className={styles.helpText}>
              Use this when you want help fitting the crops already saved to the
              plan.
            </p>
          </div>
          <button
            className={styles.secondaryButton}
            disabled={layoutRequests.length === 0 || isOptimizing}
            onClick={onGenerateAutoLayoutCandidates}
            type="button"
          >
            {isOptimizing
              ? 'Checking...'
              : hasGeneratedLayouts
                ? 'Refresh layouts'
                : 'Generate layouts'}
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
        {layoutRequests.length > 0 ? (
          <>
            <p className={styles.helpText}>
              {hasGeneratedLayouts
                ? 'Compare one idea at a time, then apply it or ignore it.'
                : `${layoutRequests.length} saved crop request${layoutRequests.length === 1 ? '' : 's'} still need room in the plan, covering ${requestedPlantCount} plant${requestedPlantCount === 1 ? '' : 's'} total.`}
            </p>
            {autoLayoutCandidates.length === 0 ? (
              <p className={styles.helpText}>
                Generate layout ideas when you want a simpler full-plot option.
              </p>
            ) : null}
            {autoLayoutCandidates.length > 0 ? (
              <PlanOptimizeCandidates
                autoLayoutCandidates={autoLayoutCandidates}
                currentWarnings={currentWarnings}
                garden={garden}
                ignoredAutoLayoutCandidateIds={ignoredAutoLayoutCandidateIds}
                layoutVariants={layoutVariants}
                onApplyAutoLayoutCandidate={onApplyAutoLayoutCandidate}
                onIgnoreAutoLayoutCandidate={onIgnoreAutoLayoutCandidate}
                onSelectAutoLayoutCandidate={onSelectAutoLayoutCandidate}
                selectedAutoLayoutCandidateId={selectedAutoLayoutCandidateId}
                sunLayer={sunLayer}
                sunSeason={sunSeason}
              />
            ) : null}
          </>
        ) : (
          <p className={styles.helpText}>
            Add plants before generating layouts.
          </p>
        )}
      </section>
    </section>
  );
}
