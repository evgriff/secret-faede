import { useState } from 'react';

import type { GardenPlan, PlanRevision } from '../../domain';
import { Button, Modal, TextField } from '../../ui';
import type { LayoutProposal, PlanIssue } from './planModel';
import styles from './PlanDialogs.module.css';

export function ReviewDialog({
  ignoredIssueIds,
  isOpen,
  issues,
  onClose,
  onIgnore,
  onRestore,
}: {
  ignoredIssueIds: Set<string>;
  isOpen: boolean;
  issues: PlanIssue[];
  onClose(): void;
  onIgnore(issueId: string): void;
  onRestore(issueId: string): void;
}) {
  const active = issues.filter((issue) => !ignoredIssueIds.has(issue.id));
  const ignored = issues.filter((issue) => ignoredIssueIds.has(issue.id));
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review plan problems"
      variant="drawer"
    >
      <div className={styles.reviewList}>
        <p>
          {active.length} active issue{active.length === 1 ? '' : 's'}. Review
          one physical change at a time.
        </p>
        {active.length === 0 ? <p>No active plan problems.</p> : null}
        {active.map((issue) => (
          <article key={issue.id}>
            <small>
              {issue.severity === 'blocking' ? 'Needs action' : 'Review'}
            </small>
            <h3>{issue.title}</h3>
            <p>{issue.message}</p>
            {issue.severity === 'blocking' ? (
              <small>
                This physical conflict must be resolved before publishing.
              </small>
            ) : (
              <Button onClick={() => onIgnore(issue.id)} variant="quiet">
                Ignore for now
              </Button>
            )}
          </article>
        ))}
        {ignored.length > 0 ? <h3>Ignored</h3> : null}
        {ignored.map((issue) => (
          <article key={issue.id}>
            <h4>{issue.title}</h4>
            <p>{issue.message}</p>
            <Button onClick={() => onRestore(issue.id)} variant="secondary">
              Restore issue
            </Button>
          </article>
        ))}
      </div>
    </Modal>
  );
}

export function LayoutProposalDialog({
  isOpen,
  onApply,
  onClose,
  proposal,
  plan,
}: {
  isOpen: boolean;
  onApply(): void;
  onClose(): void;
  plan: GardenPlan;
  proposal: LayoutProposal | null;
}) {
  return (
    <Modal
      footer={
        proposal && proposal.changes.length > 0 ? (
          <>
            <Button onClick={onClose} variant="quiet">
              Keep current layout
            </Button>
            <Button onClick={onApply}>Apply suggested moves</Button>
          </>
        ) : undefined
      }
      isOpen={isOpen}
      onClose={onClose}
      title="Layout suggestion"
    >
      <p>{proposal?.summary}</p>
      <div className={styles.proposalList}>
        {proposal?.changes.map((change) => {
          const group = plan.plantings.find(
            (item) => item.id === change.plantingGroupId,
          );
          return (
            <article key={change.plantingGroupId}>
              <strong>{group?.cropName ?? change.plantingGroupId}</strong>
              <span>
                {change.from.xFt.toFixed(1)}, {change.from.yFt.toFixed(1)} ft →{' '}
                {change.to.xFt.toFixed(1)}, {change.to.yFt.toFixed(1)} ft
              </span>
            </article>
          );
        })}
      </div>
      <p className={styles.hint}>
        This is a simple geometry-based suggestion, not a complete safety or
        growing-compatibility check. Anchored, locked, planted, and growing
        crops are never moved automatically.
      </p>
    </Modal>
  );
}

export function PublishDialog({
  isOpen,
  issueCount,
  onClose,
  onPublish,
}: {
  isOpen: boolean;
  issueCount: number;
  onClose(): void;
  onPublish(summary: string): Promise<void>;
}) {
  const [summary, setSummary] = useState('Updated garden plan');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      footer={
        <>
          <Button disabled={busy} onClick={onClose} variant="quiet">
            Cancel
          </Button>
          <Button
            isBusy={busy}
            onClick={() => {
              setBusy(true);
              void onPublish(summary).finally(() => setBusy(false));
            }}
          >
            Publish shared plan
          </Button>
        </>
      }
      isOpen={isOpen}
      onClose={onClose}
      title="Publish this private draft?"
    >
      <p>
        This replaces the shared published plan for both gardeners and creates
        an immutable revision. {issueCount} active plan issue
        {issueCount === 1 ? '' : 's'} remain.
      </p>
      <TextField
        label="Change summary"
        onChange={(event) => setSummary(event.currentTarget.value)}
        value={summary}
      />
    </Modal>
  );
}

export function HistoryDialog({
  currentRevisionId,
  isOpen,
  onClose,
  onRevert,
  revisions,
}: {
  currentRevisionId: string;
  isOpen: boolean;
  onClose(): void;
  onRevert(revisionId: string): Promise<void>;
  revisions: PlanRevision[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = revisions.find(
    (revision) => revision.revisionId === selectedId,
  );
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Published plan history">
      {!selected ? (
        <div className={styles.historyList}>
          {revisions.map((revision) => (
            <article key={revision.revisionId}>
              <div>
                <strong>{revision.changeSummary}</strong>
                <span>
                  {new Date(revision.publishedAtIso).toLocaleString()}
                </span>
              </div>
              {revision.revisionId === currentRevisionId ? (
                <small>Current</small>
              ) : (
                <Button
                  onClick={() => setSelectedId(revision.revisionId)}
                  variant="secondary"
                >
                  Review restore
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.confirmRestore}>
          <h3>Restore “{selected?.changeSummary}”?</h3>
          <p>
            The selected snapshot will be published as a new revision. Existing
            history remains intact and your private draft will be cleared.
          </p>
          <div>
            <Button onClick={() => setSelectedId(null)} variant="quiet">
              Back
            </Button>
            <Button
              onClick={() =>
                void onRevert(selectedId!).then(() => setSelectedId(null))
              }
              variant="danger"
            >
              Publish restored revision
            </Button>
          </div>
        </section>
      )}
    </Modal>
  );
}
