import { useEffect, useMemo, useRef } from 'react';

import type {
  LayoutProblem,
  LayoutProblemCategory,
  LayoutResolutionAction,
  LayoutResolutionOption,
} from '../../../domain/gardens/GardenRepository';
import type { LayoutProblemResolutionModel } from '../layoutProblemResolution';
import styles from './PlanModeDrawer.module.css';

export function PlanReviewPanel({
  activeProblemId,
  layoutModel,
  onApplyResolutionOption,
  onIgnoreProblem,
  onJumpToProblem,
  onPreviewResolutionOption,
  onSelectProblem,
}: {
  activeProblemId: string | null;
  layoutModel: LayoutProblemResolutionModel;
  onApplyResolutionOption(option: LayoutResolutionOption): void;
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
          <span className={styles.kicker}>Review problems</span>
          <h3>What needs attention</h3>
          <p>
            {inbox.openProblems.length > 0
              ? getProblemInboxSummary(inbox)
              : 'Nothing is currently blocking the saved planting plan.'}
          </p>
        </div>
        {inbox.openProblems.length > 0 ? (
          <div className={styles.reviewNextAction}>
            <span>Next step</span>
            <strong>
              Fix one issue at a time, or check the layout suggestion below.
            </strong>
          </div>
        ) : null}
      </section>

      {inbox.openProblems.length > 0 ? (
        <section className={styles.reviewGroup}>
          <div className={styles.reviewGroupHeader}>
            <h3>Needs attention</h3>
            <p>Open one issue, preview the fix, then apply it or ignore it.</p>
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
            If you want another arrangement, review the layout suggestion below.
          </p>
        </div>
      )}

      {inbox.ignoredProblems.length > 0 ? (
        <section className={styles.reviewGroup}>
          <div className={styles.reviewGroupHeader}>
            <h3>Ignored for now</h3>
            <p>These stay out of the open list until you bring them back.</p>
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
        const reasonLines = getProblemReasonLines(problem);

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
              <span
                className={styles.reviewState}
                data-tone={getProblemStateTone(problem)}
              >
                {problem.status === 'ignored'
                  ? 'Ignored for now'
                  : formatProblemSeverity(problem)}
              </span>
            </div>

            {reasonLines.length > 0 ? (
              <ul className={styles.reviewReasonList}>
                {reasonLines.map((line) => (
                  <li key={`${problem.id}:${line}`}>{line}</li>
                ))}
              </ul>
            ) : null}

            {options.length > 0 ? (
              <div className={styles.resolutionList}>
                <span className={styles.reviewCategory}>Ways to fix it</span>
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
                No quick fix is available here. Adjust the plan by hand or leave
                this issue ignored for now.
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
                {isActive ? 'Focused' : 'Focus problem'}
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
                  Ignore for now
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
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
  const actionLines = getResolutionActionLines(option);

  return (
    <section className={styles.resolutionCard}>
      <div className={styles.reviewCardHeader}>
        <div>
          <strong>{option.label}</strong>
          <p>{option.description}</p>
        </div>
        <span
          className={styles.reviewState}
          data-tone={getResolutionStateTone(option)}
        >
          {formatResolutionState(option)}
        </span>
      </div>

      <p className={styles.reviewRationale}>
        {option.estimatedImpact.needsPhysicalMove
          ? 'This changes positions on the saved plan.'
          : 'This keeps positions in place and updates the plan details.'}
      </p>

      {actionLines.length > 0 ? (
        <ul className={styles.reviewReasonList}>
          {actionLines.map((line) => (
            <li key={`${option.id}:${line}`}>{line}</li>
          ))}
        </ul>
      ) : null}

      <div className={styles.reviewActions}>
        <button
          className={styles.secondaryButton}
          disabled={isIgnored}
          onClick={() => onPreviewResolutionOption(option)}
          type="button"
        >
          Preview change
        </button>
        <button
          className={styles.primaryButton}
          disabled={!canApply || isApplied}
          onClick={() => onApplyResolutionOption(option)}
          type="button"
        >
          {isApplied ? 'Applied' : 'Apply fix'}
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
    return `${inbox.mustFixCount} must-fix issue${inbox.mustFixCount === 1 ? '' : 's'} need attention before you trust a full layout change.`;
  }

  if (inbox.recommendedCount > 0) {
    return `${inbox.recommendedCount} recommended fix${inbox.recommendedCount === 1 ? '' : 'es'} can make the plan easier to maintain.`;
  }

  return `${inbox.openProblems.length} issue${inbox.openProblems.length === 1 ? '' : 's'} remain open on this draft.`;
}

function formatProblemCategory(category: LayoutProblemCategory) {
  return category.replace(/([A-Z])/g, ' $1').trim();
}

function formatProblemSeverity(problem: LayoutProblem) {
  switch (problem.severity) {
    case 'mustFix':
      return 'Must fix';
    case 'recommended':
      return 'Worth fixing';
    case 'caution':
      return 'Watch';
  }
}

function getProblemStateTone(problem: LayoutProblem) {
  if (problem.status === 'ignored') {
    return 'neutral';
  }

  switch (problem.severity) {
    case 'mustFix':
      return 'danger';
    case 'recommended':
      return 'warning';
    case 'caution':
      return 'neutral';
  }
}

function getResolutionStateTone(option: LayoutResolutionOption) {
  if (option.status === 'applied') {
    return 'success';
  }

  if (option.status === 'ignored' || option.status === 'rejected') {
    return 'neutral';
  }

  return option.estimatedImpact.needsPhysicalMove ? 'warning' : 'success';
}

function formatResolutionState(option: LayoutResolutionOption) {
  if (option.status === 'applied') {
    return 'Applied';
  }

  if (option.status === 'ignored' || option.status === 'rejected') {
    return 'Ignored';
  }

  return option.estimatedImpact.needsPhysicalMove
    ? 'Moves layout'
    : 'Quick change';
}

function formatResolutionAction(action: LayoutResolutionAction) {
  switch (action.type) {
    case 'addStructure':
      return `Add ${action.structure.label}.`;
    case 'assignPlantSupport':
      return `Plan ${action.support.quantity} ${action.support.type} support${action.support.quantity === 1 ? '' : 's'}.`;
    case 'changePlacementMode':
      return `Switch to ${action.placementMode} planting form.`;
    case 'changePlantQuantity':
      return `Change the quantity to ${action.quantity}.`;
    case 'dismissProblem':
      return `Leave this issue ignored for now.`;
    case 'linkTrellisStructure':
      return 'Use an existing trellis line.';
    case 'movePlantGroup':
      return `Move the plant group to X ${action.xFt.toFixed(1)} ft, Y ${action.yFt.toFixed(1)} ft.`;
    case 'updateStructure':
      return 'Adjust the related structure.';
    case 'useLayoutVariant':
      return 'Apply the layout suggestion.';
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
    ...problem.evidence
      .slice(0, 3)
      .map((entry) => `${entry.label}: ${formatEvidenceValue(entry)}`),
    problem.downstreamValidation.message ?? '',
  ].filter(Boolean);
}

function getResolutionActionLines(option: LayoutResolutionOption) {
  return [
    ...option.actions.map(formatResolutionAction),
    option.downstreamValidation.message ?? '',
  ].filter(Boolean);
}
