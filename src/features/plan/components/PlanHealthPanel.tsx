import type {
  PlanHealthIssue,
  PlanHealthReport,
} from '../../garden/planHealthRules';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
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

  return (
    <section className={styles.healthPanel} aria-label="Plan health">
      <div className={styles.healthHeader}>
        <div>
          <span className={styles.kicker}>Plan health</span>
          <h3>
            {report.mustFixIssues.length} must-fix,{' '}
            {report.recommendedImprovements.length} recommended
          </h3>
        </div>
        <StatusBadge
          tone={report.mustFixIssues.length > 0 ? 'danger' : 'success'}
        >
          {totalActive === 0 ? 'clear' : totalActive}
        </StatusBadge>
      </div>

      <HealthGroup
        emptyLabel="No must-fix issues."
        issues={report.mustFixIssues}
        onDismissIssue={onDismissIssue}
        onJumpToIssue={onJumpToIssue}
        onRestoreIssue={onRestoreIssue}
        title="Must fix"
      />
      <HealthGroup
        emptyLabel="No recommended improvements."
        issues={report.recommendedImprovements.slice(0, 5)}
        onDismissIssue={onDismissIssue}
        onJumpToIssue={onJumpToIssue}
        onRestoreIssue={onRestoreIssue}
        title="Recommended"
      />
      {report.dismissedCautions.length > 0 ? (
        <HealthGroup
          emptyLabel=""
          issues={report.dismissedCautions.slice(0, 4)}
          onDismissIssue={onDismissIssue}
          onJumpToIssue={onJumpToIssue}
          onRestoreIssue={onRestoreIssue}
          title="Dismissed cautions"
        />
      ) : null}
    </section>
  );
}

function HealthGroup({
  emptyLabel,
  issues,
  onDismissIssue,
  onJumpToIssue,
  onRestoreIssue,
  title,
}: {
  emptyLabel: string;
  issues: PlanHealthIssue[];
  onDismissIssue(issue: PlanHealthIssue): void;
  onJumpToIssue(issue: PlanHealthIssue): void;
  onRestoreIssue(issue: PlanHealthIssue): void;
  title: string;
}) {
  return (
    <section className={styles.healthGroup}>
      <h4>{title}</h4>
      {issues.length > 0 ? (
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
                  <button onClick={() => onJumpToIssue(issue)} type="button">
                    Jump
                  </button>
                ) : null}
                {issue.sourceWarningId &&
                issue.dismissible &&
                !issue.dismissed ? (
                  <button onClick={() => onDismissIssue(issue)} type="button">
                    Dismiss
                  </button>
                ) : null}
                {issue.restoreWarningId ? (
                  <button onClick={() => onRestoreIssue(issue)} type="button">
                    Restore
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : emptyLabel ? (
        <p className={styles.healthEmpty}>{emptyLabel}</p>
      ) : null}
    </section>
  );
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
