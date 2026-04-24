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
          <span className={styles.kicker}>Layout ideas</span>
          <h4>Try a simpler arrangement if you want one.</h4>
          <p>
            These ideas aim for workable access, spacing, and structure use.
            Pick one to preview it, then apply it or ignore it.
          </p>
        </div>
      </header>

      <div className={styles.strategyRail} aria-label="Layout ideas">
        {layoutVariants.map((variant) => {
          const candidate = candidateById.get(variant.id);
          const isIgnored = ignoredCandidateIds.has(variant.id);
          const isSelected = variant.id === selectedAutoLayoutCandidateId;

          return (
            <button
              aria-pressed={isSelected}
              className={`${styles.strategyCard} ${
                isSelected ? styles.selectedStrategyCard : ''
              } ${isIgnored ? styles.decidedStrategyCard : ''}`}
              disabled={isIgnored || !candidate}
              key={variant.id}
              onClick={() => onSelectAutoLayoutCandidate(variant.id)}
              type="button"
            >
              <span>Layout idea</span>
              <strong>{variant.label}</strong>
              <p className={styles.strategySummary}>
                {getVariantCardSummary(variant, candidate, isIgnored)}
              </p>
              <em>{formatVariantState(variant, candidate, isIgnored)}</em>
            </button>
          );
        })}
      </div>

      {selectedVariant && selectedCandidate ? (
        <section className={styles.walkthroughFocus}>
          <div className={styles.focusHeader}>
            <div>
              <span className={styles.kicker}>Selected idea</span>
              <h4>{selectedVariant.label}</h4>
              <p>{selectedVariant.summary}</p>
            </div>
            <div className={styles.proposalBadges}>
              <span>
                {formatVariantState(selectedVariant, selectedCandidate)}
              </span>
            </div>
          </div>

          {selectedVariant.downstreamValidation.status === 'failed' ? (
            <p className={styles.variantWarning} role="status">
              {selectedVariant.downstreamValidation.message ??
                'This idea still leaves a must-fix issue in place.'}
            </p>
          ) : (
            <p className={styles.variantSuccess} role="status">
              This idea clears the must-fix issues tied to the current draft.
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
              fallback="This keeps the requested crops in a workable arrangement."
              items={getVariantHighlights(selectedVariant, selectedCandidate)}
              title="Why try it"
            />
            <DetailBlock
              fallback="Nothing important still needs attention in this idea."
              items={getVariantWatchLines(selectedVariant, selectedCandidate)}
              title="What to watch"
            />
            <DetailBlock
              fallback="This idea stays within the current plot and structure setup."
              items={getVariantOutcomeLines(selectedVariant, selectedCandidate)}
              title="What it changes"
            />
          </div>

          <div className={styles.applyBar}>
            <button
              className={styles.decisionButton}
              disabled={selectedVariantIgnored || selectedVariantBlocked}
              onClick={onApplyAutoLayoutCandidate}
              type="button"
            >
              Apply this layout
            </button>
            <button
              className={styles.decisionButton}
              disabled={selectedVariantIgnored}
              onClick={() => onIgnoreAutoLayoutCandidate(selectedVariant.id)}
              type="button"
            >
              Ignore this idea
            </button>
          </div>
        </section>
      ) : (
        <p className={styles.helpText}>Pick a layout idea to preview it.</p>
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
        <p>{fallback ?? 'No issues created by this layout idea.'}</p>
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
    return 'Cannot apply yet';
  }

  if (variant.downstreamValidation.status === 'failed') {
    return 'Still leaves work';
  }

  return candidate.unplaced.length > 0
    ? 'Leaves some crops out'
    : 'Ready to try';
}

function getVariantCardSummary(
  variant: LayoutVariant,
  candidate: AutoLayoutCandidate | undefined | null,
  isIgnored = false,
) {
  if (isIgnored) {
    return 'Set aside for this draft.';
  }

  if (!candidate) {
    return 'This saved idea no longer matches the current draft.';
  }

  if (candidate.hardConstraintViolations.length > 0) {
    return candidate.hardConstraintViolations[0] ?? 'This idea cannot apply.';
  }

  if (variant.downstreamValidation.status === 'failed') {
    return (
      variant.downstreamValidation.message ??
      'This idea still leaves a must-fix issue behind.'
    );
  }

  if (candidate.unplaced.length > 0) {
    return `${candidate.unplaced.length} crop${candidate.unplaced.length === 1 ? '' : 's'} would stay unplaced.`;
  }

  return variant.summary;
}

function getVariantHighlights(
  variant: LayoutVariant,
  candidate: AutoLayoutCandidate,
) {
  return uniqueLines([
    variant.summary,
    ...candidate.explanations.filter(
      (line) =>
        !/recursive solver/i.test(line) && !/^Checked plot bounds/i.test(line),
    ),
  ]);
}

function getVariantWatchLines(
  variant: LayoutVariant,
  candidate: AutoLayoutCandidate,
) {
  return uniqueLines([
    ...candidate.hardConstraintViolations,
    variant.downstreamValidation.status === 'failed'
      ? (variant.downstreamValidation.message ?? '')
      : '',
    ...candidate.unplaced.map(
      (entry) => `${entry.cropName} stays unplaced: ${entry.reason}`,
    ),
    ...candidate.tradeoffs.filter((line) =>
      /tight|mixed|still|needs|could not|review the plot/i.test(line),
    ),
  ]);
}

function getVariantOutcomeLines(
  variant: LayoutVariant,
  candidate: AutoLayoutCandidate,
) {
  return uniqueLines([
    ...candidate.tradeoffs.filter(
      (line) =>
        !/tight|mixed|still|needs|could not|review the plot/i.test(line),
    ),
    ...variant.assumptions,
  ]);
}

function uniqueLines(lines: string[]) {
  return [...new Set(lines.filter(Boolean))];
}
