import type {
  Garden,
  LayoutVariant,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import type { PlanWarning } from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import type { AutoLayoutCandidate } from '../autoLayoutTypes';
import { PlanOptimizePreview } from './PlanOptimizePreview';
import styles from './PlanOptimizeCandidates.module.css';
import { ReasonTooltip, ReasonTooltipList } from './ReasonTooltip';

export function PlanOptimizeCandidates({
  autoLayoutCandidates,
  currentWarnings,
  garden,
  ignoredAutoLayoutCandidateIds,
  layoutVariants,
  onApplyAutoLayoutCandidate,
  onIgnoreAutoLayoutCandidate,
  onSelectAutoLayoutCandidate,
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
  onIgnoreAutoLayoutCandidate(candidateId: string): void;
  onSelectAutoLayoutCandidate(candidateId: string): void;
  selectedAutoLayoutCandidateId: string | null;
  sunLayer: SunShadeLayer | null;
  sunSeason: SunSeason;
}) {
  const ignoredCandidateIds = new Set(ignoredAutoLayoutCandidateIds);
  const candidateById = new Map(
    autoLayoutCandidates.map((candidate) => [candidate.id, candidate]),
  );
  const selectedVariant =
    layoutVariants.find(
      (variant) => variant.id === selectedAutoLayoutCandidateId,
    ) ?? null;
  const selectedCandidate = selectedVariant
    ? (candidateById.get(selectedVariant.id) ?? null)
    : null;
  const selectedVariantIgnored = Boolean(
    selectedVariant && ignoredCandidateIds.has(selectedVariant.id),
  );
  const selectedVariantBlocked = Boolean(
    selectedCandidate &&
    selectedVariant &&
    (selectedCandidate.hardConstraintViolations.length > 0 ||
      selectedVariant.downstreamValidation.status === 'failed'),
  );

  return (
    <div className={styles.walkthroughPanel}>
      <header className={styles.walkthroughHeader}>
        <div>
          <span className={styles.kicker}>Variant comparison</span>
          <h4>Compare fully checked layout variants.</h4>
          <p>
            Each variant has already been run through downstream conflict
            checks. Apply only a complete variant, or ignore it for this draft.
          </p>
        </div>
      </header>

      <div className={styles.strategyRail} aria-label="Checked variants">
        {layoutVariants.map((variant) => {
          const candidate = candidateById.get(variant.id);
          const isIgnored = ignoredCandidateIds.has(variant.id);
          const isSelected = variant.id === selectedAutoLayoutCandidateId;
          const reasonId = `variant-reason-${variant.id}`;

          return (
            <button
              aria-describedby={reasonId}
              aria-pressed={isSelected}
              className={`${styles.strategyCard} ${
                isSelected ? styles.selectedStrategyCard : ''
              } ${isIgnored ? styles.decidedStrategyCard : ''}`}
              disabled={isIgnored || !candidate}
              key={variant.id}
              onClick={() => onSelectAutoLayoutCandidate(variant.id)}
              type="button"
            >
              <span>Checked variant</span>
              <strong>{variant.label}</strong>
              <em>{formatVariantState(variant, candidate, isIgnored)}</em>
              <span
                className={styles.variantReason}
                id={reasonId}
                role="tooltip"
              >
                {getVariantReasonLines(variant, candidate, isIgnored).join(' ')}
              </span>
            </button>
          );
        })}
      </div>

      {selectedVariant && selectedCandidate ? (
        <section className={styles.walkthroughFocus}>
          <div className={styles.focusHeader}>
            <div>
              <span className={styles.kicker}>Selected variant</span>
              <h4>{selectedVariant.label}</h4>
              <p>{selectedVariant.summary}</p>
            </div>
            <div className={styles.proposalBadges}>
              <ReasonTooltip
                ariaLabel={`${selectedVariant.label} status reason`}
                content={
                  <ReasonTooltipList
                    lines={getVariantReasonLines(
                      selectedVariant,
                      selectedCandidate,
                    )}
                  />
                }
              >
                <span>
                  {formatVariantState(selectedVariant, selectedCandidate)}
                </span>
              </ReasonTooltip>
              <ReasonTooltip
                ariaLabel={`${selectedVariant.label} ranking reason`}
                content={
                  <ReasonTooltipList
                    lines={getVariantRankingLines(selectedVariant)}
                  />
                }
              >
                <span>ranked variant</span>
              </ReasonTooltip>
            </div>
          </div>

          {selectedVariant.downstreamValidation.status === 'failed' ? (
            <p className={styles.variantWarning} role="status">
              {selectedVariant.downstreamValidation.message ??
                'This variant still has unresolved must-fix problems.'}
            </p>
          ) : (
            <p className={styles.variantSuccess} role="status">
              Checked downstream: no must-fix problems attached to this variant.
            </p>
          )}

          <PlanOptimizePreview
            candidate={selectedCandidate}
            currentWarnings={currentWarnings}
            garden={garden}
            sunLayer={sunLayer}
            sunSeason={sunSeason}
          />

          <div className={styles.walkthroughDetailGrid}>
            <DetailBlock
              fallback="No unresolved must-fix problems are attached."
              items={selectedVariant.problems.map(
                (problem) => `${problem.title}: ${problem.description}`,
              )}
              title="Problems checked"
            />
            <DetailBlock
              fallback="No separate resolution option is needed."
              items={selectedVariant.resolutionOptions.map(
                (option) => `${option.label}: ${option.description}`,
              )}
              title="Resolution options"
            />
            <DetailBlock
              fallback="No tradeoff introduced by this variant."
              items={[
                ...selectedCandidate.tradeoffs,
                ...selectedCandidate.unplaced.map(
                  (entry) => `${entry.cropName}: ${entry.reason}`,
                ),
                ...selectedCandidate.hardConstraintViolations,
              ]}
              title="Tradeoffs introduced"
            />
            <DetailBlock
              items={[
                getSearchSummary(selectedCandidate),
                ...selectedVariant.assumptions,
                ...selectedCandidate.search.unresolvedIssues.map(
                  (issue) => `Still unresolved: ${issue}`,
                ),
              ]}
              title="Solver check"
            />
          </div>

          <div className={styles.applyBar}>
            <button
              className={styles.decisionButton}
              disabled={selectedVariantIgnored || selectedVariantBlocked}
              onClick={onApplyAutoLayoutCandidate}
              type="button"
            >
              Apply full variant to draft
            </button>
            <button
              className={styles.decisionButton}
              disabled={selectedVariantIgnored}
              onClick={() => onIgnoreAutoLayoutCandidate(selectedVariant.id)}
              type="button"
            >
              Ignore variant
            </button>
          </div>
        </section>
      ) : (
        <p className={styles.helpText}>
          Select a checked variant to inspect the downstream result.
        </p>
      )}
    </div>
  );
}

function DetailBlock({
  fallback,
  items,
  title,
}: {
  fallback?: string;
  items: string[];
  title: string;
}) {
  const visibleItems = items.filter(Boolean).slice(0, 4);

  return (
    <section className={styles.detailBlock}>
      <h5>{title}</h5>
      {visibleItems.length > 0 ? (
        <ul>
          {visibleItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{fallback ?? 'No issues created by this variant.'}</p>
      )}
    </section>
  );
}

function formatVariantState(
  variant: LayoutVariant,
  candidate: AutoLayoutCandidate | undefined | null,
  isIgnored = false,
) {
  if (isIgnored) {
    return 'Ignored';
  }

  if (!candidate) {
    return 'Unavailable';
  }

  if (candidate.hardConstraintViolations.length > 0) {
    return 'Blocked by hard constraint';
  }

  if (variant.downstreamValidation.status === 'failed') {
    return `${variant.downstreamValidation.remainingProblemIds.length} unresolved`;
  }

  if (candidate.search.status === 'resolved') {
    return 'Checked and resolved';
  }

  return candidate.unplaced.length > 0
    ? 'Checked with unplaced crops'
    : 'Checked variant';
}

function getVariantReasonLines(
  variant: LayoutVariant,
  candidate: AutoLayoutCandidate | undefined | null,
  isIgnored = false,
) {
  if (isIgnored) {
    return ['This variant was intentionally ignored for this private draft.'];
  }

  if (!candidate) {
    return ['The saved variant no longer has matching generated geometry.'];
  }

  if (candidate.hardConstraintViolations.length > 0) {
    return candidate.hardConstraintViolations.slice(0, 3);
  }

  if (variant.downstreamValidation.status === 'failed') {
    return [
      variant.downstreamValidation.message ??
        'Downstream checks found unresolved problems.',
      ...variant.problems
        .filter((problem) =>
          variant.downstreamValidation.remainingProblemIds.includes(problem.id),
        )
        .map((problem) => `${problem.title}: ${problem.description}`),
    ];
  }

  if (candidate.unplaced.length > 0) {
    return candidate.unplaced.map(
      (entry) => `${entry.cropName} is unplaced: ${entry.reason}`,
    );
  }

  if (candidate.search.status === 'resolved') {
    return [
      `Solver checked ${candidate.search.evaluatedStates} states and pruned ${candidate.search.repeatedStates} repeated states before surfacing this variant.`,
      'No must-fix downstream problem is attached to this variant.',
    ];
  }

  return [
    `Solver checked ${candidate.search.evaluatedStates} states to depth ${candidate.search.reachedDepth}/${candidate.search.maxDepth}.`,
    variant.downstreamValidation.message ?? 'No must-fix problem is attached.',
  ];
}

function getVariantRankingLines(variant: LayoutVariant) {
  return [
    `Access ${variant.score.components.access}, spacing ${variant.score.components.spacing}, sun ${variant.score.components.sun}, support ${variant.score.components.support}.`,
    'The rank is a deterministic heuristic for comparing variants, not a yield prediction.',
  ];
}

function getSearchSummary(candidate: AutoLayoutCandidate) {
  return `Checked ${candidate.search.evaluatedStates} layout state${candidate.search.evaluatedStates === 1 ? '' : 's'}; pruned ${candidate.search.repeatedStates} repeat${candidate.search.repeatedStates === 1 ? '' : 's'} and ${candidate.search.prunedStates} capped branch${candidate.search.prunedStates === 1 ? '' : 'es'}.`;
}
