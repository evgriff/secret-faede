import { useEffect, useMemo, useRef } from 'react';

import type {
  LayoutProblem,
  LayoutProblemCategory,
  LayoutResolutionAction,
  LayoutResolutionOption,
  LayoutVariant,
} from '../../../domain/gardens/GardenRepository';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
import type { LayoutProblemResolutionModel } from '../layoutProblemResolution';
import styles from './PlanModeDrawer.module.css';
import { ReasonTooltip, ReasonTooltipList } from './ReasonTooltip';

export function PlanReviewPanel({
  activeProblemId,
  layoutModel,
  onApplyResolutionOption,
  onGenerateVariants,
  onIgnoreProblem,
  onJumpToProblem,
  onPreviewResolutionOption,
  onSelectProblem,
}: {
  activeProblemId: string | null;
  layoutModel: LayoutProblemResolutionModel;
  onApplyResolutionOption(option: LayoutResolutionOption): void;
  onGenerateVariants(): void;
  onIgnoreProblem(problem: LayoutProblem): void;
  onJumpToProblem(problem: LayoutProblem): void;
  onPreviewResolutionOption(option: LayoutResolutionOption): void;
  onSelectProblem(problemId: string | null): void;
}) {
  const inbox = useMemo(() => buildProblemInbox(layoutModel), [layoutModel]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView?.({ block: 'start' });
  }, [inbox.openProblems.length]);

  return (
    <div className={styles.reviewPanel} ref={panelRef}>
      <section className={styles.reviewHero}>
        <div>
          <span className={styles.kicker}>Problem inbox</span>
          <h3>
            {inbox.openProblems.length} open problem
            {inbox.openProblems.length === 1 ? '' : 's'}
          </h3>
          <p>{getProblemInboxSummary(inbox)}</p>
          <p className={styles.reviewDecisionSummary}>
            {inbox.mustFixCount} must fix / {inbox.recommendedCount} recommended
            / {inbox.ignoredCount} ignored
          </p>
        </div>
        <div className={styles.reviewNextAction}>
          <span>Next safe action</span>
          <strong>{getNextProblemAction(inbox)}</strong>
        </div>
        <div className={styles.reviewHeroActions}>
          <button
            className={styles.secondaryButton}
            onClick={onGenerateVariants}
            type="button"
          >
            Generate checked variants
          </button>
        </div>
      </section>

      {inbox.openProblems.length > 0 ? (
        <section className={styles.reviewGroup}>
          <div className={styles.reviewGroupHeader}>
            <h3>Current problems</h3>
            <p>
              Pick a problem, inspect the reason, then apply a complete
              resolution or intentionally ignore it.
            </p>
          </div>
          <ProblemCards
            activeProblemId={activeProblemId}
            onApplyResolutionOption={onApplyResolutionOption}
            onIgnoreProblem={onIgnoreProblem}
            onJumpToProblem={onJumpToProblem}
            onPreviewResolutionOption={onPreviewResolutionOption}
            onSelectProblem={onSelectProblem}
            optionsByProblemId={inbox.optionsByProblemId}
            problems={inbox.openProblems}
          />
        </section>
      ) : (
        <div className={styles.reviewEmpty}>
          <p className={styles.successText}>No current layout problems.</p>
          <p className={styles.mutedText}>
            Generate checked variants if you want a whole-plot comparison.
          </p>
        </div>
      )}

      {inbox.ignoredProblems.length > 0 ? (
        <section className={styles.reviewGroup}>
          <div className={styles.reviewGroupHeader}>
            <h3>Ignored problems</h3>
            <p>Recorded for this private draft.</p>
          </div>
          <ProblemCards
            activeProblemId={activeProblemId}
            onApplyResolutionOption={onApplyResolutionOption}
            onIgnoreProblem={onIgnoreProblem}
            onJumpToProblem={onJumpToProblem}
            onPreviewResolutionOption={onPreviewResolutionOption}
            onSelectProblem={onSelectProblem}
            optionsByProblemId={inbox.optionsByProblemId}
            problems={inbox.ignoredProblems}
          />
        </section>
      ) : null}

      {inbox.variants.length > 0 ? (
        <section className={styles.reviewGroup}>
          <div className={styles.reviewGroupHeader}>
            <h3>Variant status</h3>
            <p>
              Variants below have downstream checks; compare the full details in
              Variant Comparison.
            </p>
          </div>
          <ul className={styles.variantStatusList}>
            {inbox.variants.slice(0, 3).map((variant) => (
              <li key={variant.id}>
                <strong>{variant.label}</strong>
                <StatusBadge tone={getValidationTone(variant)}>
                  {formatValidationStatus(variant)}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ProblemCards({
  activeProblemId,
  onApplyResolutionOption,
  onIgnoreProblem,
  onJumpToProblem,
  onPreviewResolutionOption,
  onSelectProblem,
  optionsByProblemId,
  problems,
}: {
  activeProblemId: string | null;
  onApplyResolutionOption(option: LayoutResolutionOption): void;
  onIgnoreProblem(problem: LayoutProblem): void;
  onJumpToProblem(problem: LayoutProblem): void;
  onPreviewResolutionOption(option: LayoutResolutionOption): void;
  onSelectProblem(problemId: string | null): void;
  optionsByProblemId: Map<string, LayoutResolutionOption[]>;
  problems: LayoutProblem[];
}) {
  return (
    <ul className={styles.reviewList}>
      {problems.map((problem) => {
        const isActive = problem.id === activeProblemId;
        const options = optionsByProblemId.get(problem.id) ?? [];
        const canJump = problem.targets.length > 0;

        return (
          <li
            className={`${styles.reviewCard} ${
              problem.status !== 'open' ? styles.reviewCardDecided : ''
            } ${isActive ? styles.reviewCardActive : ''}`}
            key={problem.id}
          >
            <div className={styles.reviewCardHeader}>
              <div>
                <span className={styles.reviewCategory}>
                  {formatProblemCategory(problem.category)}
                </span>
                <strong>{problem.title}</strong>
                <p>{problem.description}</p>
              </div>
              <div className={styles.reviewBadges}>
                <ReasonTooltip
                  ariaLabel={`${problem.title} severity reason`}
                  content={
                    <ReasonTooltipList lines={getProblemReasonLines(problem)} />
                  }
                >
                  <StatusBadge tone={getProblemSeverityTone(problem)}>
                    {formatProblemSeverity(problem)}
                  </StatusBadge>
                </ReasonTooltip>
                {problem.status === 'ignored' ? (
                  <ReasonTooltip
                    ariaLabel={`${problem.title} ignored reason`}
                    content="Ignored problems stay recorded on this private draft and are excluded from the open problem count."
                  >
                    <StatusBadge>ignored</StatusBadge>
                  </ReasonTooltip>
                ) : null}
              </div>
            </div>

            <EvidenceList problem={problem} />

            {problem.downstreamValidation.status !== 'notRun' ? (
              <div className={styles.reviewDecisionLine}>
                <span>Downstream check</span>
                <strong>
                  {problem.downstreamValidation.message ??
                    formatValidationStatus(problem)}
                </strong>
              </div>
            ) : null}

            {options.length > 0 ? (
              <div className={styles.resolutionList}>
                <span className={styles.reviewCategory}>
                  Resolution options
                </span>
                {options.map((option) => (
                  <ResolutionOptionCard
                    key={option.id}
                    onApplyResolutionOption={onApplyResolutionOption}
                    onPreviewResolutionOption={onPreviewResolutionOption}
                    option={option}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.reviewRationale}>
                No draft-safe automatic resolution is available. Adjust the plot
                manually or ignore this problem with a note in the draft record.
              </p>
            )}

            <div className={styles.reviewActions}>
              <button
                aria-pressed={isActive}
                className={
                  isActive ? styles.primaryButton : styles.secondaryButton
                }
                onClick={() => onSelectProblem(isActive ? null : problem.id)}
                type="button"
              >
                {isActive ? 'Problem selected' : 'Select problem'}
              </button>
              {canJump ? (
                <button
                  className={styles.secondaryButton}
                  onClick={() => onJumpToProblem(problem)}
                  type="button"
                >
                  Jump to plot
                </button>
              ) : null}
              {problem.status === 'open' ? (
                <button
                  className={styles.secondaryButton}
                  onClick={() => onIgnoreProblem(problem)}
                  type="button"
                >
                  Ignore problem
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function EvidenceList({ problem }: { problem: LayoutProblem }) {
  const evidence = problem.evidence.slice(0, 3);

  if (evidence.length === 0) {
    return null;
  }

  return (
    <dl className={styles.previewGrid}>
      {evidence.map((entry) => (
        <div key={`${problem.id}:${entry.label}:${entry.value}`}>
          <dt>{entry.label}</dt>
          <dd>{formatEvidenceValue(entry)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ResolutionOptionCard({
  onApplyResolutionOption,
  onPreviewResolutionOption,
  option,
}: {
  onApplyResolutionOption(option: LayoutResolutionOption): void;
  onPreviewResolutionOption(option: LayoutResolutionOption): void;
  option: LayoutResolutionOption;
}) {
  const isApplied = option.status === 'applied';
  const isIgnored = option.status === 'ignored' || option.status === 'rejected';
  const canApply =
    option.status === 'available' &&
    option.actions.some((action) => action.type !== 'dismissProblem');

  return (
    <section className={styles.resolutionCard}>
      <div className={styles.reviewCardHeader}>
        <div>
          <strong>{option.label}</strong>
          <p>{option.description}</p>
        </div>
        <div className={styles.reviewBadges}>
          <ReasonTooltip
            ariaLabel={`${option.label} status reason`}
            content={
              <ReasonTooltipList lines={getResolutionReasonLines(option)} />
            }
          >
            <StatusBadge tone={getResolutionTone(option)}>
              {formatResolutionStatus(option)}
            </StatusBadge>
          </ReasonTooltip>
          {option.estimatedImpact.needsPhysicalMove ? (
            <ReasonTooltip
              ariaLabel={`${option.label} physical move reason`}
              content="This resolution changes a saved plant-group or structure position. Preview the tradeoff before applying it."
            >
              <StatusBadge tone="warning">physical move</StatusBadge>
            </ReasonTooltip>
          ) : (
            <ReasonTooltip
              ariaLabel={`${option.label} planned-only reason`}
              content="This resolution updates planning attributes or support state without moving saved plant centers."
            >
              <StatusBadge>planned only</StatusBadge>
            </ReasonTooltip>
          )}
        </div>
      </div>
      <p className={styles.reviewRationale}>
        {option.actions.map(formatResolutionAction).join('; ')}
      </p>
      <div className={styles.reviewActions}>
        <button
          className={styles.secondaryButton}
          disabled={isIgnored}
          onClick={() => onPreviewResolutionOption(option)}
          type="button"
        >
          Show tradeoff
        </button>
        <button
          className={styles.primaryButton}
          disabled={!canApply || isApplied}
          onClick={() => onApplyResolutionOption(option)}
          type="button"
        >
          {isApplied ? 'Resolution applied' : 'Apply complete resolution'}
        </button>
      </div>
    </section>
  );
}

interface ProblemInboxModel {
  ignoredCount: number;
  ignoredProblems: LayoutProblem[];
  mustFixCount: number;
  openProblems: LayoutProblem[];
  optionsByProblemId: Map<string, LayoutResolutionOption[]>;
  recommendedCount: number;
  variants: LayoutVariant[];
}

function buildProblemInbox(
  layoutModel: LayoutProblemResolutionModel,
): ProblemInboxModel {
  const variantOptionProblemIds = new Set(
    layoutModel.resolutionOptions
      .filter(isVariantResolutionOption)
      .map((option) => option.problemId),
  );
  const problems = layoutModel.problems.filter(
    (problem) => !variantOptionProblemIds.has(problem.id),
  );
  const openProblems = problems.filter((problem) => problem.status === 'open');
  const ignoredProblems = problems.filter(
    (problem) => problem.status === 'ignored',
  );
  const optionsByProblemId = new Map<string, LayoutResolutionOption[]>();

  for (const option of layoutModel.resolutionOptions) {
    if (isVariantResolutionOption(option)) {
      continue;
    }

    optionsByProblemId.set(option.problemId, [
      ...(optionsByProblemId.get(option.problemId) ?? []),
      option,
    ]);
  }

  return {
    ignoredCount: ignoredProblems.length,
    ignoredProblems,
    mustFixCount: openProblems.filter(
      (problem) => problem.severity === 'mustFix',
    ).length,
    openProblems,
    optionsByProblemId,
    recommendedCount: openProblems.filter(
      (problem) => problem.severity === 'recommended',
    ).length,
    variants: layoutModel.variants,
  };
}

function isVariantResolutionOption(option: LayoutResolutionOption) {
  return option.actions.some((action) => action.type === 'useLayoutVariant');
}

function getProblemInboxSummary(inbox: ProblemInboxModel) {
  if (inbox.openProblems.length === 0) {
    return 'The current draft has no open layout problems.';
  }

  if (inbox.mustFixCount > 0) {
    return 'Resolve must-fix issues before applying a full layout variant.';
  }

  return 'Review recommended fixes, then apply a complete resolution or ignore it intentionally.';
}

function getNextProblemAction(inbox: ProblemInboxModel) {
  if (inbox.mustFixCount > 0) {
    return 'Solve a must-fix problem';
  }

  if (inbox.openProblems.length > 0) {
    return 'Choose a resolution option';
  }

  return inbox.variants.length > 0
    ? 'Compare checked variants'
    : 'Generate checked variants';
}

function formatProblemCategory(category: LayoutProblemCategory) {
  return category.replace(/([A-Z])/g, ' $1');
}

function formatProblemSeverity(problem: LayoutProblem) {
  switch (problem.severity) {
    case 'mustFix':
      return 'must fix';
    case 'recommended':
      return 'recommended';
    case 'caution':
      return 'caution';
  }
}

function getProblemSeverityTone(problem: LayoutProblem) {
  switch (problem.severity) {
    case 'mustFix':
      return 'danger' as const;
    case 'recommended':
      return 'warning' as const;
    case 'caution':
      return 'neutral' as const;
  }
}

function getResolutionTone(option: LayoutResolutionOption) {
  if (option.status === 'applied') {
    return 'success' as const;
  }

  if (option.status === 'ignored' || option.status === 'rejected') {
    return 'neutral' as const;
  }

  return option.estimatedImpact.needsPhysicalMove ? 'warning' : 'success';
}

function formatResolutionStatus(option: LayoutResolutionOption) {
  if (option.status === 'ignored' || option.status === 'rejected') {
    return 'ignored';
  }

  return option.status === 'available' ? 'available' : option.status;
}

function formatResolutionAction(action: LayoutResolutionAction) {
  switch (action.type) {
    case 'addStructure':
      return `Add ${action.structure.label}`;
    case 'assignPlantSupport':
      return `Assign ${action.support.quantity} ${action.support.type}`;
    case 'changePlacementMode':
      return `Change planting form to ${action.placementMode}`;
    case 'changePlantQuantity':
      return `Set quantity to ${action.quantity}`;
    case 'dismissProblem':
      return `Ignore: ${action.reason}`;
    case 'linkTrellisStructure':
      return `Link trellis ${action.structureId}`;
    case 'movePlantGroup':
      return `Move plant group to ${action.xFt.toFixed(1)}, ${action.yFt.toFixed(
        1,
      )} ft`;
    case 'updateStructure':
      return `Update structure ${action.structureId}`;
    case 'useLayoutVariant':
      return `Use checked variant ${action.variantId}`;
  }
}

function formatEvidenceValue(entry: LayoutProblem['evidence'][number]) {
  if (typeof entry.value === 'number' && entry.unit) {
    return `${entry.value} ${entry.unit}`;
  }

  return String(entry.value);
}

function getProblemReasonLines(problem: LayoutProblem) {
  return [
    problem.description,
    ...problem.evidence
      .slice(0, 3)
      .map((entry) => `${entry.label}: ${formatEvidenceValue(entry)}`),
    problem.downstreamValidation.message ?? '',
  ].filter(Boolean);
}

function getResolutionReasonLines(option: LayoutResolutionOption) {
  return [
    option.description,
    ...option.actions.map(formatResolutionAction),
    option.downstreamValidation.message ?? '',
  ].filter(Boolean);
}

function formatValidationStatus(
  value: Pick<LayoutProblem | LayoutVariant, 'downstreamValidation'>,
) {
  const validation = value.downstreamValidation;

  if (validation.status === 'passed') {
    return 'checked: no must-fix problems';
  }

  if (validation.status === 'failed') {
    return validation.message ?? 'checked: unresolved problems remain';
  }

  if (validation.status === 'warning') {
    return validation.message ?? 'checked with warnings';
  }

  return validation.status === 'stale' ? 'check is stale' : 'not checked';
}

function getValidationTone(variant: LayoutVariant) {
  return variant.downstreamValidation.status === 'passed'
    ? 'success'
    : 'warning';
}
