import { useEffect, useRef } from 'react';

import type { GardenSuggestionDecision } from '../../../domain/gardens/gardenWorkspace';
import type { ReviewSuggestion } from '../../garden/reviewSuggestions';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
import {
  buildReviewProposalInbox,
  getReviewProposalCategory,
  getReviewProposalChangeSummary,
  getReviewProposalNextAction,
  getReviewProposalUrgency,
} from '../reviewProposalInbox';
import styles from './PlanModeDrawer.module.css';

export function PlanReviewPanel({
  activeSuggestionId,
  onAcceptBatch,
  onAcceptSuggestion,
  onGenerateAutoLayoutCandidates,
  onJumpToSuggestion,
  onPreviewSuggestion,
  onRejectSuggestion,
  onSnoozeSuggestion,
  reviewSuggestions,
  suggestionDecisions,
}: {
  activeSuggestionId: string | null;
  onAcceptBatch(suggestions: ReviewSuggestion[]): void;
  onAcceptSuggestion(suggestion: ReviewSuggestion): void;
  onGenerateAutoLayoutCandidates(): void;
  onJumpToSuggestion(suggestion: ReviewSuggestion): void;
  onPreviewSuggestion(suggestion: ReviewSuggestion): void;
  onRejectSuggestion(suggestion: ReviewSuggestion): void;
  onSnoozeSuggestion(suggestion: ReviewSuggestion): void;
  reviewSuggestions: ReviewSuggestion[];
  suggestionDecisions: GardenSuggestionDecision[];
}) {
  const inbox = buildReviewProposalInbox({
    reviewSuggestions,
    suggestionDecisions,
  });
  const nextAction = getReviewProposalNextAction(inbox);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView?.({ block: 'start' });
  }, [suggestionDecisions.length]);

  return (
    <div className={styles.reviewPanel} ref={panelRef}>
      <section className={styles.reviewHero}>
        <div>
          <span className={styles.kicker}>Proposal inbox</span>
          <h3>
            {inbox.openSuggestions.length} decision
            {inbox.openSuggestions.length === 1 ? '' : 's'} waiting
          </h3>
          <p>{nextAction.detail}</p>
          <p className={styles.reviewDecisionSummary}>
            {inbox.batchableSuggestions.length} low-risk support /{' '}
            {inbox.stats.physicalMoveCount} physical /{' '}
            {inbox.stats.layoutCount + inbox.stats.placementCount} layout work
          </p>
        </div>
        <div className={styles.reviewNextAction}>
          <span>Next safe action</span>
          <strong>{nextAction.label}</strong>
        </div>
        <div className={styles.reviewHeroActions}>
          <button
            className={styles.secondaryButton}
            onClick={onGenerateAutoLayoutCandidates}
            type="button"
          >
            Generate layouts
          </button>
          <button
            className={
              inbox.stats.physicalMoveCount > 0
                ? styles.secondaryButton
                : styles.primaryButton
            }
            disabled={inbox.batchableSuggestions.length === 0}
            onClick={() => onAcceptBatch(inbox.batchableSuggestions)}
            type="button"
          >
            Accept low-risk support ({inbox.batchableSuggestions.length})
          </button>
        </div>
      </section>

      {inbox.openSuggestions.length > 0 ? (
        <section className={styles.reviewGroup}>
          <div className={styles.reviewGroupHeader}>
            <h3>Decision queue</h3>
            <p>Review the top proposal, then accept, reject, or snooze.</p>
          </div>
          <SuggestionCards
            activeSuggestionId={activeSuggestionId}
            decisionById={inbox.decisionById}
            onAcceptSuggestion={onAcceptSuggestion}
            onJumpToSuggestion={onJumpToSuggestion}
            onPreviewSuggestion={onPreviewSuggestion}
            onRejectSuggestion={onRejectSuggestion}
            onSnoozeSuggestion={onSnoozeSuggestion}
            suggestions={inbox.openSuggestions}
          />
        </section>
      ) : (
        <div className={styles.reviewEmpty}>
          <p className={styles.successText}>No open review proposals.</p>
          <p className={styles.mutedText}>
            Generate layouts or edit the plan to surface new decisions.
          </p>
        </div>
      )}

      {inbox.decidedSuggestions.length > 0 ? (
        <section className={styles.reviewGroup}>
          <div className={styles.reviewGroupHeader}>
            <h3>Accepted, rejected, and snoozed</h3>
            <p>Recorded for this private draft.</p>
          </div>
          <SuggestionCards
            activeSuggestionId={activeSuggestionId}
            decisionById={inbox.decisionById}
            onAcceptSuggestion={onAcceptSuggestion}
            onJumpToSuggestion={onJumpToSuggestion}
            onPreviewSuggestion={onPreviewSuggestion}
            onRejectSuggestion={onRejectSuggestion}
            onSnoozeSuggestion={onSnoozeSuggestion}
            suggestions={inbox.decidedSuggestions}
          />
        </section>
      ) : null}
    </div>
  );
}

function SuggestionCards({
  activeSuggestionId,
  decisionById,
  onAcceptSuggestion,
  onJumpToSuggestion,
  onPreviewSuggestion,
  onRejectSuggestion,
  onSnoozeSuggestion,
  suggestions,
}: {
  activeSuggestionId: string | null;
  decisionById: Map<string, GardenSuggestionDecision>;
  onAcceptSuggestion(suggestion: ReviewSuggestion): void;
  onJumpToSuggestion(suggestion: ReviewSuggestion): void;
  onPreviewSuggestion(suggestion: ReviewSuggestion): void;
  onRejectSuggestion(suggestion: ReviewSuggestion): void;
  onSnoozeSuggestion(suggestion: ReviewSuggestion): void;
  suggestions: ReviewSuggestion[];
}) {
  return (
    <ul className={styles.reviewList}>
      {suggestions.map((suggestion) => {
        const decision = decisionById.get(suggestion.id);
        const urgency = getReviewProposalUrgency(suggestion);
        const isActive = suggestion.id === activeSuggestionId;
        const needsPhysicalPreview =
          suggestion.relocationImpact === 'physicalMove' && !isActive;

        return (
          <li
            className={`${styles.reviewCard} ${
              decision ? styles.reviewCardDecided : ''
            } ${isActive ? styles.reviewCardActive : ''}`}
            key={suggestion.id}
          >
            <div className={styles.reviewCardHeader}>
              <div>
                <span className={styles.reviewCategory}>
                  {getReviewProposalCategory(suggestion)}
                </span>
                <strong>{suggestion.title}</strong>
                <p>{suggestion.preview?.after ?? suggestion.rationale}</p>
              </div>
              <div className={styles.reviewBadges}>
                <StatusBadge tone={urgency.tone}>{urgency.label}</StatusBadge>
                {suggestion.relocationImpact &&
                suggestion.relocationImpact !== 'none' ? (
                  <StatusBadge
                    tone={
                      suggestion.relocationImpact === 'physicalMove'
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {formatRelocationImpact(suggestion.relocationImpact)}
                  </StatusBadge>
                ) : null}
                {decision ? (
                  <StatusBadge
                    tone={
                      decision.status === 'accepted' ? 'success' : 'neutral'
                    }
                  >
                    {decision.status}
                  </StatusBadge>
                ) : null}
              </div>
            </div>
            <div className={styles.reviewDecisionLine}>
              <span>Decision</span>
              <strong>{getReviewProposalChangeSummary(suggestion)}</strong>
            </div>
            <p className={styles.reviewRationale}>{suggestion.rationale}</p>
            {suggestion.relocationImpact === 'physicalMove' ? (
              <p className={styles.physicalMoveText}>
                Preview the plot diff before accepting a physical move.
              </p>
            ) : null}
            {suggestion.preview ? (
              <dl className={styles.previewGrid}>
                <div>
                  <dt>Before</dt>
                  <dd>{suggestion.preview.before}</dd>
                </div>
                <div>
                  <dt>After</dt>
                  <dd>{suggestion.preview.after}</dd>
                </div>
              </dl>
            ) : null}
            {decision ? (
              <p className={styles.reviewDecisionText}>
                {formatDecisionText(decision.status)}
              </p>
            ) : null}
            <div className={styles.reviewActions}>
              <button
                aria-pressed={isActive}
                className={
                  isActive ? styles.primaryButton : styles.secondaryButton
                }
                onClick={() => onPreviewSuggestion(suggestion)}
                type="button"
              >
                {isActive ? 'Diff on plot' : 'Show diff'}
              </button>
              {suggestion.itemIds.length > 0 ? (
                <button
                  className={styles.secondaryButton}
                  onClick={() => onJumpToSuggestion(suggestion)}
                  type="button"
                >
                  Jump to plot
                </button>
              ) : null}
              {!decision ? (
                <>
                  <button
                    className={
                      suggestion.relocationImpact === 'physicalMove'
                        ? `${styles.secondaryButton} ${styles.physicalMoveButton}`
                        : styles.primaryButton
                    }
                    onClick={() =>
                      needsPhysicalPreview
                        ? onPreviewSuggestion(suggestion)
                        : onAcceptSuggestion(suggestion)
                    }
                    type="button"
                  >
                    {needsPhysicalPreview
                      ? 'Show diff first'
                      : suggestion.relocationImpact === 'physicalMove'
                        ? 'Accept physical move'
                        : 'Accept'}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => onRejectSuggestion(suggestion)}
                    type="button"
                  >
                    Reject
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => onSnoozeSuggestion(suggestion)}
                    type="button"
                  >
                    Snooze
                  </button>
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatRelocationImpact(
  impact: NonNullable<ReviewSuggestion['relocationImpact']>,
) {
  if (impact === 'physicalMove') {
    return 'physical move';
  }

  return impact === 'plannedOnly' ? 'planned only' : 'no move';
}

function formatDecisionText(status: GardenSuggestionDecision['status']) {
  if (status === 'accepted') {
    return 'Accepted into this draft.';
  }

  if (status === 'rejected') {
    return 'Rejected for this draft.';
  }

  return 'Snoozed for this draft.';
}
