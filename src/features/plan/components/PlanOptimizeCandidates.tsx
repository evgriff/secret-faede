import type {
  Garden,
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
  onApplyAutoLayoutCandidate,
  onRejectAutoLayoutCandidate,
  onSelectAutoLayoutCandidate,
  onSnoozeAutoLayoutCandidate,
  rejectedAutoLayoutCandidateIds,
  selectedAutoLayoutCandidateId,
  snoozedAutoLayoutCandidateIds,
  sunLayer,
  sunSeason,
}: {
  autoLayoutCandidates: AutoLayoutCandidate[];
  currentWarnings: PlanWarning[];
  garden: Garden;
  onApplyAutoLayoutCandidate(): void;
  onRejectAutoLayoutCandidate(candidateId: string): void;
  onSelectAutoLayoutCandidate(candidateId: string): void;
  onSnoozeAutoLayoutCandidate(candidateId: string): void;
  rejectedAutoLayoutCandidateIds: string[];
  selectedAutoLayoutCandidateId: string | null;
  snoozedAutoLayoutCandidateIds: string[];
  sunLayer: SunShadeLayer | null;
  sunSeason: SunSeason;
}) {
  const rejectedCandidateIds = new Set(rejectedAutoLayoutCandidateIds);
  const snoozedCandidateIds = new Set(snoozedAutoLayoutCandidateIds);
  const selectedCandidate =
    autoLayoutCandidates.find(
      (candidate) => candidate.id === selectedAutoLayoutCandidateId,
    ) ?? null;
  const selectedCandidateRejected = Boolean(
    selectedCandidate && rejectedCandidateIds.has(selectedCandidate.id),
  );
  const selectedCandidateSnoozed = Boolean(
    selectedCandidate && snoozedCandidateIds.has(selectedCandidate.id),
  );

  return (
    <div className={styles.walkthroughPanel}>
      <header className={styles.walkthroughHeader}>
        <div>
          <span className={styles.kicker}>Proposal walkthrough</span>
          <h4>Choose a strategy, inspect movement, then decide.</h4>
          <p>
            Preview keeps the draft unchanged until you explicitly apply a
            selected proposal.
          </p>
        </div>
      </header>

      <div className={styles.strategyRail} aria-label="Candidate strategies">
        {autoLayoutCandidates.map((candidate) => {
          const isRejected = rejectedCandidateIds.has(candidate.id);
          const isSnoozed = snoozedCandidateIds.has(candidate.id);
          const isSelected = candidate.id === selectedAutoLayoutCandidateId;

          return (
            <button
              aria-pressed={isSelected}
              className={`${styles.strategyCard} ${
                isSelected ? styles.selectedStrategyCard : ''
              } ${isRejected || isSnoozed ? styles.decidedStrategyCard : ''}`}
              disabled={isRejected || isSnoozed}
              key={candidate.id}
              onClick={() => onSelectAutoLayoutCandidate(candidate.id)}
              type="button"
            >
              <span>{formatStrategy(candidate.strategy)}</span>
              <strong>{candidate.label}</strong>
              <em>{getProposalStateLabel(candidate, isRejected, isSnoozed)}</em>
            </button>
          );
        })}
      </div>
      {selectedCandidate ? (
        <section className={styles.walkthroughFocus}>
          <div className={styles.focusHeader}>
            <div>
              <span className={styles.kicker}>Selected strategy</span>
              <h4>{selectedCandidate.label}</h4>
              <p>{selectedCandidate.explanations[0]}</p>
            </div>
            <div className={styles.proposalBadges}>
              <span>
                {getProposalStateLabel(
                  selectedCandidate,
                  selectedCandidateRejected,
                  selectedCandidateSnoozed,
                )}
              </span>
            </div>
          </div>
          <PlanOptimizePreview
            candidate={selectedCandidate}
            currentWarnings={currentWarnings}
            garden={garden}
            sunLayer={sunLayer}
            sunSeason={sunSeason}
          />
          <div className={styles.walkthroughDetailGrid}>
            <DetailBlock
              items={selectedCandidate.explanations}
              title="Why this strategy"
            />
            <DetailBlock
              fallback="No new support materials."
              items={selectedCandidate.materials}
              title="Support and materials"
            />
            <DetailBlock
              items={[
                ...selectedCandidate.tradeoffs,
                ...selectedCandidate.hardConstraintViolations,
                ...selectedCandidate.unplaced.map(
                  (entry) => `${entry.cropName}: ${entry.reason}`,
                ),
              ]}
              title="Warnings and tradeoffs"
            />
          </div>
          <div className={styles.applyBar}>
            <button
              className={styles.decisionButton}
              disabled={
                selectedCandidateRejected ||
                selectedCandidateSnoozed ||
                selectedCandidate.hardConstraintViolations.length > 0
              }
              onClick={onApplyAutoLayoutCandidate}
              type="button"
            >
              Apply selected proposal to draft
            </button>
            <button
              className={styles.decisionButton}
              disabled={selectedCandidateRejected || selectedCandidateSnoozed}
              onClick={() => onRejectAutoLayoutCandidate(selectedCandidate.id)}
              type="button"
            >
              Reject selected proposal
            </button>
            <button
              className={styles.decisionButton}
              disabled={selectedCandidateRejected || selectedCandidateSnoozed}
              onClick={() => onSnoozeAutoLayoutCandidate(selectedCandidate.id)}
              type="button"
            >
              Snooze selected proposal
            </button>
          </div>
        </section>
      ) : (
        <p className={styles.helpText}>
          Select a strategy to preview the draft change.
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
        <p>{fallback ?? 'No issues created by this proposal.'}</p>
      )}
    </section>
  );
}

function formatStrategy(strategy: AutoLayoutCandidate['strategy']) {
  if (strategy === 'accessFirst') {
    return 'Path access';
  }

  return strategy === 'supportFirst' ? 'Support clearance' : 'Sun exposure';
}

function getProposalStateLabel(
  candidate: AutoLayoutCandidate,
  isRejected = false,
  isSnoozed = false,
) {
  if (isRejected) {
    return 'Rejected';
  }

  if (isSnoozed) {
    return 'Snoozed';
  }

  if (candidate.hardConstraintViolations.length > 0) {
    return 'Needs review';
  }

  return candidate.unplaced.length > 0 ? 'Partial layout' : 'Ready layout';
}
