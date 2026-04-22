import type {
  PlanHealthDecisionGroup,
  PlanHealthIssue,
  PlanHealthReport,
} from '../../garden/planHealthRules';
import {
  ActionButton,
  InfoChip,
  StatusBadge,
} from '../../shared/design/DesignPrimitives';
import styles from './PlanModeDrawer.module.css';

export function PlanHealthPanel({
  onDismissIssue,
  onJumpToIssue,
  onRestoreIssue,
  report,
}: {
  onDismissIssue(issue: PlanHealthIssue): void;
  onJumpToIssue(issue: PlanHealthIssue): void;
  onRestoreIssue(issue: PlanHealthIssue): void;
  report: PlanHealthReport;
}) {
  const totalActive =
    report.mustFixIssues.length + report.recommendedImprovements.length;
  const groupCount = report.decisionGroups.length;

  return (
    <section className={styles.healthPanel} aria-label="Plan health">
      <div className={styles.healthHeader}>
        <div>
          <span className={styles.kicker}>Plan health</span>
          <h3>
            {totalActive === 0
              ? 'No decisions waiting'
              : `${totalActive} ${totalActive === 1 ? 'decision' : 'decisions'} to review`}
          </h3>
          <p>
            {groupCount === 0
              ? 'Spacing, support, sun, paths, and bed fit are quiet.'
              : `${groupCount} ${groupCount === 1 ? 'category' : 'categories'} grouped by the choice to make.`}
          </p>
        </div>
        <StatusBadge
          tone={report.mustFixIssues.length > 0 ? 'danger' : 'success'}
        >
          {report.mustFixIssues.length > 0 ? 'needs choice' : 'quiet'}
        </StatusBadge>
      </div>

      {report.decisionGroups.length > 0 ? (
        <div className={styles.healthDecisionGroups}>
          {report.decisionGroups.map((group) => (
            <HealthDecisionGroup
              group={group}
              key={group.category}
              onDismissIssue={onDismissIssue}
              onJumpToIssue={onJumpToIssue}
              onRestoreIssue={onRestoreIssue}
            />
          ))}
        </div>
      ) : (
        <p className={styles.healthEmpty}>No active planning checks.</p>
      )}
      {report.dismissedCautions.length > 0 ? (
        <details className={styles.healthDecisionGroup}>
          <summary className={styles.healthSummary}>
            <span>
              <strong>Dismissed cautions</strong>
              <small>Restorable notes hidden from active Review.</small>
            </span>
            <InfoChip>{report.dismissedCautions.length} hidden</InfoChip>
          </summary>
          <HealthIssueList
            issues={report.dismissedCautions.slice(0, 4)}
            onDismissIssue={onDismissIssue}
            onJumpToIssue={onJumpToIssue}
            onRestoreIssue={onRestoreIssue}
          />
        </details>
      ) : null}
    </section>
  );
}

function HealthDecisionGroup({
  group,
  onDismissIssue,
  onJumpToIssue,
  onRestoreIssue,
}: {
  group: PlanHealthDecisionGroup;
  onDismissIssue(issue: PlanHealthIssue): void;
  onJumpToIssue(issue: PlanHealthIssue): void;
  onRestoreIssue(issue: PlanHealthIssue): void;
}) {
  return (
    <details
      className={styles.healthDecisionGroup}
      open={group.mustFixCount > 0}
    >
      <summary className={styles.healthSummary}>
        <span>
          <strong>{group.label}</strong>
          <small>{group.prompt}</small>
        </span>
        <span className={styles.healthCounts}>
          {group.mustFixCount > 0 ? (
            <StatusBadge tone="danger">
              {group.mustFixCount} must-fix
            </StatusBadge>
          ) : null}
          {group.recommendedCount > 0 ? (
            <InfoChip tone="warning">
              {group.recommendedCount} recommended
            </InfoChip>
          ) : null}
          {group.cautionCount > 0 ? (
            <InfoChip>{group.cautionCount} note</InfoChip>
          ) : null}
        </span>
      </summary>
      <HealthIssueList
        issues={group.issues}
        onDismissIssue={onDismissIssue}
        onJumpToIssue={onJumpToIssue}
        onRestoreIssue={onRestoreIssue}
      />
    </details>
  );
}

function HealthIssueList({
  issues,
  onDismissIssue,
  onJumpToIssue,
  onRestoreIssue,
}: {
  issues: PlanHealthIssue[];
  onDismissIssue(issue: PlanHealthIssue): void;
  onJumpToIssue(issue: PlanHealthIssue): void;
  onRestoreIssue(issue: PlanHealthIssue): void;
}) {
  return (
    <ul className={styles.healthList}>
      {issues.map((issue) => (
        <li className={styles.healthItem} key={issue.id}>
          <div>
            <strong>{issue.title}</strong>
            <span>{issue.message}</span>
            {issue.materialAddOns.length > 0 ? (
              <small>
                Add:{' '}
                {issue.materialAddOns
                  .slice(0, 2)
                  .map(
                    (addOn) =>
                      `${formatQuantity(addOn.quantity)} ${addOn.unit} ${addOn.label}`,
                  )
                  .join('; ')}
              </small>
            ) : null}
          </div>
          <div className={styles.healthActions}>
            {issue.itemIds.length > 0 ? (
              <ActionButton
                intent="neutral"
                onClick={() => onJumpToIssue(issue)}
                priority="secondary"
              >
                Jump
              </ActionButton>
            ) : null}
            {issue.sourceWarningId && issue.dismissible && !issue.dismissed ? (
              <ActionButton
                intent="neutral"
                onClick={() => onDismissIssue(issue)}
                priority="ghost"
              >
                Dismiss
              </ActionButton>
            ) : null}
            {issue.restoreWarningId ? (
              <ActionButton
                intent="neutral"
                onClick={() => onRestoreIssue(issue)}
                priority="secondary"
              >
                Restore
              </ActionButton>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
