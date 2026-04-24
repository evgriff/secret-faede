import { useMemo, useState } from 'react';

import type {
  Garden,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import type { PlanWarning } from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import {
  buildAutoLayoutProposalPreview,
  type AutoLayoutPreviewRect,
} from '../autoLayoutProposalDiff';
import type { AutoLayoutCandidate } from '../autoLayoutTypes';
import styles from './PlanOptimizeCandidates.module.css';

type PreviewMode = 'after' | 'before' | 'split';

export function PlanOptimizePreview({
  candidate,
  currentWarnings,
  garden,
  sunLayer,
  sunSeason,
}: {
  candidate: AutoLayoutCandidate;
  currentWarnings: PlanWarning[];
  garden: Garden;
  sunLayer: SunShadeLayer | null;
  sunSeason: SunSeason;
}) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('split');
  const preview = useMemo(
    () =>
      buildAutoLayoutProposalPreview({
        candidate,
        currentWarnings,
        garden,
        sunLayer,
        sunSeason,
      }),
    [candidate, currentWarnings, garden, sunLayer, sunSeason],
  );
  const showBefore = previewMode === 'before' || previewMode === 'split';
  const showAfter = previewMode === 'after' || previewMode === 'split';

  return (
    <section
      className={styles.previewPanel}
      aria-label="Before and after preview"
    >
      <div className={styles.previewHeader}>
        <div>
          <span className={styles.kicker}>Before / after</span>
          <h4>Layout preview</h4>
        </div>
        <div className={styles.previewBadges}>
          <span>{preview.summary.addedCount} added</span>
          <span>{preview.summary.movedCount} moved</span>
          <span>{preview.summary.removedCount} removed</span>
        </div>
      </div>

      <div
        className={styles.previewSwitch}
        aria-label="Preview mode"
        role="group"
      >
        {(['split', 'before', 'after'] as const).map((mode) => (
          <button
            aria-pressed={previewMode === mode}
            className={previewMode === mode ? styles.previewSwitchActive : ''}
            key={mode}
            onClick={() => setPreviewMode(mode)}
            type="button"
          >
            {formatPreviewMode(mode)}
          </button>
        ))}
      </div>

      <div
        className={`${styles.previewFrames} ${
          previewMode === 'split' ? styles.previewSplit : styles.previewSingle
        }`}
      >
        {showBefore ? (
          <PreviewFrame
            label="Current draft"
            plotDepthFt={garden.plot.depthFt}
            plotWidthFt={garden.plot.widthFt}
            rects={preview.beforeRects}
          />
        ) : null}
        {showAfter ? (
          <PreviewFrame
            label="Suggested layout"
            plotDepthFt={garden.plot.depthFt}
            plotWidthFt={garden.plot.widthFt}
            rects={preview.afterRects}
          />
        ) : null}
      </div>

      <dl className={styles.previewImpactGrid}>
        <ImpactTerm
          label="Warnings avoided"
          value={formatWarningList(preview.summary.avoidedWarnings, 'None')}
        />
        <ImpactTerm
          label="Warnings introduced"
          tone={
            preview.summary.introducedWarnings.length > 0
              ? 'warning'
              : 'neutral'
          }
          value={formatWarningList(preview.summary.introducedWarnings, 'None')}
        />
        <ImpactTerm
          label="Open warnings"
          value={`${preview.summary.totalBeforeWarnings} -> ${preview.summary.totalAfterWarnings}`}
        />
        <ImpactTerm
          label="Support additions"
          value={`${preview.summary.supportAdditions}`}
        />
      </dl>
    </section>
  );
}

function PreviewFrame({
  label,
  plotDepthFt,
  plotWidthFt,
  rects,
}: {
  label: string;
  plotDepthFt: number;
  plotWidthFt: number;
  rects: AutoLayoutPreviewRect[];
}) {
  return (
    <figure className={styles.previewFrame}>
      <figcaption>{label}</figcaption>
      <svg
        aria-label={`${label} plot preview`}
        className={styles.previewSvg}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${plotWidthFt} ${plotDepthFt}`}
      >
        <rect
          className={styles.previewPlot}
          height={plotDepthFt}
          width={plotWidthFt}
          x="0"
          y="0"
        />
        {rects.map((rect) => (
          <g key={`${label}-${rect.itemType}-${rect.id}`}>
            <rect
              className={`${styles.previewRect} ${getRectClass(rect)}`}
              height={Math.max(rect.rect.depthFt, 0.15)}
              rx="0.12"
              vectorEffect="non-scaling-stroke"
              width={Math.max(rect.rect.widthFt, 0.15)}
              x={rect.rect.xFt}
              y={rect.rect.yFt}
            />
            {rect.kind !== 'unchanged' ? (
              <text
                className={styles.previewLabel}
                dominantBaseline="middle"
                textAnchor="middle"
                x={rect.rect.xFt + rect.rect.widthFt / 2}
                y={rect.rect.yFt + rect.rect.depthFt / 2}
              >
                {formatChangeLabel(rect.kind)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </figure>
  );
}

function ImpactTerm({
  label,
  tone = 'neutral',
  value,
}: {
  label: string;
  tone?: 'neutral' | 'warning';
  value: string;
}) {
  return (
    <div className={tone === 'warning' ? styles.previewImpactWarning : ''}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function getRectClass(rect: AutoLayoutPreviewRect) {
  if (rect.kind === 'added') {
    return styles.previewAdded;
  }

  if (rect.kind === 'moved') {
    return styles.previewMoved;
  }

  if (rect.kind === 'removed') {
    return styles.previewRemoved;
  }

  return rect.itemType === 'structure'
    ? styles.previewStructure
    : styles.previewUnchanged;
}

function formatPreviewMode(mode: PreviewMode) {
  if (mode === 'split') {
    return 'Split';
  }

  return mode === 'before' ? 'Before' : 'After';
}

function formatChangeLabel(kind: AutoLayoutPreviewRect['kind']) {
  if (kind === 'added') {
    return '+';
  }

  if (kind === 'removed') {
    return '-';
  }

  return kind === 'moved' ? 'move' : '';
}

function formatWarningList(warnings: string[], fallback: string) {
  return warnings.length > 0 ? warnings.join(', ') : fallback;
}
