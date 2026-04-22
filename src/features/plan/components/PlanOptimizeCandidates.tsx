import { useMemo } from 'react';

import type {
  Garden,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import type { PlanWarning } from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
import { buildAutoLayoutProposalPreview } from '../autoLayoutProposalDiff';
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
  rejectedAutoLayoutCandidateIds,
  selectedAutoLayoutCandidateId,
  sunLayer,
  sunSeason,
}: {
  autoLayoutCandidates: AutoLayoutCandidate[];
  currentWarnings: PlanWarning[];
  garden: Garden;
  onApplyAutoLayoutCandidate(): void;
  onRejectAutoLayoutCandidate(candidateId: string): void;
  onSelectAutoLayoutCandidate(candidateId: string): void;
  rejectedAutoLayoutCandidateIds: string[];
  selectedAutoLayoutCandidateId: string | null;
  sunLayer: SunShadeLayer | null;
  sunSeason: SunSeason;
}) {
  const rejectedCandidateIds = new Set(rejectedAutoLayoutCandidateIds);
  const selectedCandidate =
    autoLayoutCandidates.find(
      (candidate) => candidate.id === selectedAutoLayoutCandidateId,
    ) ?? null;
  const selectedCandidateRejected = Boolean(
    selectedCandidate && rejectedCandidateIds.has(selectedCandidate.id),
  );
  const candidateImpacts = useMemo(
    () =>
      new Map(
        autoLayoutCandidates.map((candidate) => [
          candidate.id,
          buildAutoLayoutProposalPreview({
            candidate,
            currentWarnings,
            garden,
            sunLayer,
            sunSeason,
          }).summary,
        ]),
      ),
    [autoLayoutCandidates, currentWarnings, garden, sunLayer, sunSeason],
  );

  return (
    <div className={styles.proposalStack}>
      <div className={styles.proposalGrid}>
        {autoLayoutCandidates.map((candidate) => {
          const isRejected = rejectedCandidateIds.has(candidate.id);
          const isSelected = candidate.id === selectedAutoLayoutCandidateId;
          const impact = candidateImpacts.get(candidate.id);

          return (
            <article
              className={`${styles.proposalCard} ${
                isSelected ? styles.selectedProposalCard : ''
              } ${isRejected ? styles.rejectedProposalCard : ''}`}
              key={candidate.id}
            >
              <div className={styles.proposalHeader}>
                <div>
                  <strong>{candidate.label}</strong>
                  <span>{formatStrategy(candidate.strategy)}</span>
                </div>
                <div className={styles.proposalBadges}>
                  <StatusBadge
                    tone={candidate.score >= 70 ? 'success' : 'warning'}
                  >
                    {candidate.score}/100
                  </StatusBadge>
                  {isRejected ? (
                    <StatusBadge tone="neutral">rejected</StatusBadge>
                  ) : null}
                </div>
              </div>
              <dl className={styles.scoreGrid}>
                <ScoreTerm
                  label="Sun"
                  value={candidate.scoreBreakdown.sunFit}
                />
                <ScoreTerm
                  label="Access"
                  value={candidate.scoreBreakdown.access}
                />
                <ScoreTerm
                  label="Support"
                  value={candidate.scoreBreakdown.support}
                />
                <ScoreTerm
                  label="Shade"
                  value={candidate.scoreBreakdown.shadeManagement}
                />
                <ScoreTerm
                  label="Season"
                  value={candidate.scoreBreakdown.seasonalSuitability}
                />
                <ScoreTerm
                  label="Spacing"
                  value={candidate.scoreBreakdown.spacingQuality}
                />
              </dl>
              <div className={styles.proposalImpact}>
                <span>Avoids {impact?.avoidedWarnings.length ?? 0}</span>
                <span>Introduces {impact?.introducedWarnings.length ?? 0}</span>
                <span>Support adds {impact?.supportAdditions ?? 0}</span>
              </div>
              <ul>
                {candidate.explanations.slice(0, 2).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
                {candidate.tradeoffs.slice(0, 2).map((tradeoff) => (
                  <li key={tradeoff}>{tradeoff}</li>
                ))}
              </ul>
              <small>
                {candidate.materials.length > 0
                  ? candidate.materials.slice(0, 3).join('; ')
                  : 'No new support materials.'}
              </small>
              {candidate.hardConstraintViolations.length > 0 ? (
                <p className={styles.error}>
                  {candidate.hardConstraintViolations.length} hard constraint
                  issue
                  {candidate.hardConstraintViolations.length === 1 ? '' : 's'}
                </p>
              ) : null}
              {candidate.unplaced.length > 0 ? (
                <small>
                  Unplaced:{' '}
                  {candidate.unplaced
                    .map((entry) => entry.cropName)
                    .slice(0, 3)
                    .join(', ')}
                </small>
              ) : null}
              <div className={styles.proposalActions}>
                <button
                  className={styles.secondaryButton}
                  disabled={isRejected}
                  onClick={() => onSelectAutoLayoutCandidate(candidate.id)}
                  type="button"
                >
                  {isSelected ? 'Previewing' : 'Preview'}
                </button>
                <button
                  className={styles.rejectButton}
                  disabled={isRejected}
                  onClick={() => onRejectAutoLayoutCandidate(candidate.id)}
                  type="button"
                >
                  Reject
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {selectedCandidate ? (
        <PlanOptimizePreview
          candidate={selectedCandidate}
          currentWarnings={currentWarnings}
          garden={garden}
          sunLayer={sunLayer}
          sunSeason={sunSeason}
        />
      ) : (
        <p className={styles.helpText}>
          Select a candidate to preview the draft change.
        </p>
      )}
      <div className={styles.applyBar}>
        <button
          className={styles.secondaryButton}
          disabled={
            !selectedCandidate ||
            selectedCandidateRejected ||
            selectedCandidate.hardConstraintViolations.length > 0
          }
          onClick={onApplyAutoLayoutCandidate}
          type="button"
        >
          Apply selected proposal to draft
        </button>
        {selectedCandidate ? (
          <button
            className={styles.rejectButton}
            disabled={selectedCandidateRejected}
            onClick={() => onRejectAutoLayoutCandidate(selectedCandidate.id)}
            type="button"
          >
            Reject selected proposal
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ScoreTerm({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{Math.round(value * 100)}%</dd>
    </div>
  );
}

function formatStrategy(strategy: AutoLayoutCandidate['strategy']) {
  if (strategy === 'accessFirst') {
    return 'Access-first strategy';
  }

  return strategy === 'supportFirst'
    ? 'Support-first strategy'
    : 'Sun-first strategy';
}
