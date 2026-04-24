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
  autoLayoutSuggestion,
  currentWarnings,
  garden,
  onApplyAutoLayoutCandidate,
  onDismissAutoLayoutSuggestion,
  suggestion,
  sunLayer,
  sunSeason,
}: {
  autoLayoutSuggestion: AutoLayoutCandidate;
  currentWarnings: PlanWarning[];
  garden: Garden;
  onApplyAutoLayoutCandidate(): void;
  onDismissAutoLayoutSuggestion(): void;
  suggestion: LayoutVariant;
  sunLayer: SunShadeLayer | null;
  sunSeason: SunSeason;
}) {
  const suggestionBlocked =
    autoLayoutSuggestion.hardConstraintViolations.length > 0 ||
    suggestion.downstreamValidation.status === 'failed';

  return (
    <div className={styles.walkthroughPanel}>
      <header className={styles.walkthroughHeader}>
        <div>
          <span className={styles.kicker}>Layout suggestion</span>
          <h4>Here is a simpler arrangement to consider.</h4>
          <p>
            This checked suggestion aims for workable access, spacing, and
            support without overbuilding the plot.
          </p>
        </div>
      </header>

      <section className={styles.walkthroughFocus}>
        {suggestion.downstreamValidation.status === 'failed' ? (
          <p className={styles.variantWarning} role="status">
            {suggestion.downstreamValidation.message ??
              'This suggestion still leaves a must-fix issue behind.'}
          </p>
        ) : (
          <p className={styles.variantSuccess} role="status">
            This suggestion clears the must-fix issues tied to the current
            draft.
          </p>
        )}

        <PlanOptimizePreview
          candidate={autoLayoutSuggestion}
          currentWarnings={currentWarnings}
          garden={garden}
          sunLayer={sunLayer}
          sunSeason={sunSeason}
        />

        <div className={styles.walkthroughDetailGrid}>
          <DetailBlock
            fallback="This keeps the requested crops in a workable arrangement."
            items={getSuggestionHighlights(suggestion, autoLayoutSuggestion)}
            title="Why it is better"
          />
          <DetailBlock
            fallback="Nothing important still needs attention in this suggestion."
            items={getSuggestionWatchLines(suggestion, autoLayoutSuggestion)}
            title="What to watch"
          />
        </div>

        <div className={styles.applyBar}>
          <button
            className={styles.decisionButton}
            disabled={suggestionBlocked}
            onClick={onApplyAutoLayoutCandidate}
            type="button"
          >
            Apply this layout
          </button>
          <button
            className={styles.decisionButton}
            onClick={onDismissAutoLayoutSuggestion}
            type="button"
          >
            Keep current layout
          </button>
        </div>
      </section>
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
        <p>{fallback ?? 'No issues created by this layout suggestion.'}</p>
      )}
    </section>
  );
}

function getSuggestionHighlights(
  suggestion: LayoutVariant,
  candidate: AutoLayoutCandidate,
) {
  return uniqueLines([
    suggestion.summary,
    ...candidate.explanations.filter(
      (line) =>
        !/recursive solver/i.test(line) && !/^Checked plot bounds/i.test(line),
    ),
    ...candidate.tradeoffs.filter((line) =>
      /clear route|legal clearance|support spots|grouped/i.test(line),
    ),
  ]);
}

function getSuggestionWatchLines(
  suggestion: LayoutVariant,
  candidate: AutoLayoutCandidate,
) {
  return uniqueLines([
    ...candidate.hardConstraintViolations,
    suggestion.downstreamValidation.status === 'failed'
      ? (suggestion.downstreamValidation.message ?? '')
      : '',
    ...candidate.unplaced.map(
      (entry) => `${entry.cropName} stays unplaced: ${entry.reason}`,
    ),
    ...candidate.tradeoffs.filter((line) =>
      /tight|mixed|still|needs|could not|review the plot/i.test(line),
    ),
  ]);
}

function uniqueLines(lines: string[]) {
  return [...new Set(lines.filter(Boolean))];
}
