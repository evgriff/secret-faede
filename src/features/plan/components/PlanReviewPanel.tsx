import type { GardenSuggestionDecision } from '../../../domain/gardens/gardenWorkspace';
import type { ReviewSuggestion } from '../../garden/reviewSuggestions';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
import {
  buildReviewProposalInbox,
  getReviewProposalCategory,
  getReviewProposalChangeSummary,
  getReviewProposalUrgency,
} from '../reviewProposalInbox';
import styles from './PlanModeDrawer.module.css';

export function PlanReviewPanel({
  onAcceptBatch,
  onAcceptSuggestion,
  onGenerateAutoLayoutCandidates,
  onJumpToSuggestion,
  onRejectSuggestion,
  onSnoozeSuggestion,
  reviewSuggestions,
  suggestionDecisions,
}: {
  onAcceptBatch(suggestions: ReviewSuggestion[]): void;
  onAcceptSuggestion(suggestion: ReviewSuggestion): void;
  onGenerateAutoLayoutCandidates(): void;
  onJumpToSuggestion(suggestion: ReviewSuggestion): void;
  onRejectSuggestion(suggestion: ReviewSuggestion): void;
  onSnoozeSuggestion(suggestion: ReviewSuggestion): void;
  reviewSuggestions: ReviewSuggestion[];
  suggestionDecisions: GardenSuggestionDecision[];
}) {
  const inbox = buildReviewProposalInbox({
    reviewSuggestions,
    suggestionDecisions,
  });

  return (
    <div className={styles.reviewPanel}>
      <section className={styles.reviewHero}>
        <div>
          <span className={styles.kicker}>Proposal inbox</span>
          <h3>
            {inbox.openSuggestions.length} change
            {inbox.openSuggestions.length === 1 ? '' : 's'} waiting
          </h3>
          <p>Accept, reject, or snooze draft changes before they happen.</p>
          <div className={styles.reviewStats} aria-label="Proposal summary">
            <span>{inbox.stats.layoutCount} layout</span>
            <span>{inbox.stats.supportCount} support</span>
            <span>{inbox.stats.placementCount} placement</span>
            <span>{inbox.stats.physicalMoveCount} physical</span>
          </div>
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
            className={styles.primaryButton}
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
          <h3>Ready to review</h3>
          <SuggestionCards
            decisionById={inbox.decisionById}
            onAcceptSuggestion={onAcceptSuggestion}
            onJumpToSuggestion={onJumpToSuggestion}
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
          <h3>Accepted, rejected, and snoozed</h3>
          <SuggestionCards
            decisionById={inbox.decisionById}
            onAcceptSuggestion={onAcceptSuggestion}
            onJumpToSuggestion={onJumpToSuggestion}
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
  decisionById,
  onAcceptSuggestion,
  onJumpToSuggestion,
  onRejectSuggestion,
  onSnoozeSuggestion,
  suggestions,
}: {
  decisionById: Map<string, GardenSuggestionDecision>;
  onAcceptSuggestion(suggestion: ReviewSuggestion): void;
  onJumpToSuggestion(suggestion: ReviewSuggestion): void;
  onRejectSuggestion(suggestion: ReviewSuggestion): void;
  onSnoozeSuggestion(suggestion: ReviewSuggestion): void;
  suggestions: ReviewSuggestion[];
}) {
  return (
    <ul className={styles.reviewList}>
      {suggestions.map((suggestion) => {
        const decision = decisionById.get(suggestion.id);
        const urgency = getReviewProposalUrgency(suggestion);

        return (
          <li
            className={`${styles.reviewCard} ${
              decision ? styles.reviewCardDecided : ''
            }`}
            key={suggestion.id}
          >
            <div className={styles.reviewCardHeader}>
              <div>
                <span className={styles.reviewCategory}>
                  {getReviewProposalCategory(suggestion)}
                </span>
                <strong>{suggestion.title}</strong>
              </div>
              <div className={styles.reviewBadges}>
                <StatusBadge tone={urgency.tone}>{urgency.label}</StatusBadge>
                <StatusBadge>
                  {formatConfidence(suggestion.confidence)}
                </StatusBadge>
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
            <dl className={styles.reviewMetaGrid}>
              <div>
                <dt>Change</dt>
                <dd>{getReviewProposalChangeSummary(suggestion)}</dd>
              </div>
              <div>
                <dt>Why</dt>
                <dd>{suggestion.rationale}</dd>
              </div>
            </dl>
            {suggestion.relocationImpact === 'physicalMove' ? (
              <p className={styles.physicalMoveText}>
                Accepting this updates the plan for a crop already planted in
                the garden.
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
              {suggestion.itemIds.length > 0 ? (
                <button
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
                        ? styles.physicalMoveButton
                        : undefined
                    }
                    onClick={() => onAcceptSuggestion(suggestion)}
                    type="button"
                  >
                    {suggestion.relocationImpact === 'physicalMove'
                      ? 'Accept physical move'
                      : 'Accept'}
                  </button>
                  <button
                    onClick={() => onRejectSuggestion(suggestion)}
                    type="button"
                  >
                    Reject
                  </button>
                  <button
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

function formatConfidence(confidence: ReviewSuggestion['confidence']) {
  return `${confidence} confidence`;
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
