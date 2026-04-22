import { useEffect, useId, useState } from 'react';

import type { CropFocusSummary, CropFocusView } from '../planCropFocus';
import styles from './PlanCropFocusCard.module.css';

const focusViews: Array<{ id: CropFocusView; label: string }> = [
  { id: 'selected', label: 'Plant' },
  { id: 'crop', label: 'Crop' },
  { id: 'needs', label: 'Needs' },
];

export function PlanCropFocusCard({
  influenceSummary,
  onClose,
  onOpenDetails,
  onShowInfluenceChange,
  showInfluence,
  summary,
}: {
  influenceSummary: {
    keepAway: string;
    shade: string;
    warnings: string[];
  } | null;
  onClose(): void;
  onOpenDetails(): void;
  onShowInfluenceChange(value: boolean): void;
  showInfluence: boolean;
  summary: CropFocusSummary;
}) {
  const tabPanelId = useId();
  const [view, setView] = useState<CropFocusView>('selected');

  useEffect(() => {
    setView('selected');
  }, [summary.selectionKey]);

  const activeTabId = `${tabPanelId}-${view}-tab`;
  const activePanelId = `${tabPanelId}-${view}-panel`;

  return (
    <aside className={styles.card} aria-label="Crop focus">
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>Selected plant</span>
          <h2>{summary.selected.label}</h2>
          <p>{summary.crop.name} crop focus</p>
        </div>
        <button
          aria-label="Close crop focus"
          className={styles.iconButton}
          onClick={onClose}
          type="button"
        >
          x
        </button>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Crop focus views">
        {focusViews.map((entry) => (
          <button
            aria-controls={`${tabPanelId}-${entry.id}-panel`}
            aria-selected={view === entry.id}
            className={view === entry.id ? styles.activeTab : ''}
            id={`${tabPanelId}-${entry.id}-tab`}
            key={entry.id}
            onClick={() => setView(entry.id)}
            role="tab"
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div
        aria-labelledby={activeTabId}
        aria-live="polite"
        className={styles.body}
        id={activePanelId}
        role="tabpanel"
      >
        {view === 'selected' ? <SelectedView summary={summary} /> : null}
        {view === 'crop' ? <CropView summary={summary} /> : null}
        {view === 'needs' ? <NeedsView summary={summary} /> : null}
      </div>

      {showInfluence && influenceSummary ? (
        <div className={styles.influenceSummary}>
          <strong>Influence shown</strong>
          <p>{influenceSummary.keepAway}</p>
          <p>{influenceSummary.shade}</p>
          {influenceSummary.warnings.length > 0 ? (
            <p>{influenceSummary.warnings.join(', ')}</p>
          ) : null}
        </div>
      ) : null}

      <div className={styles.actions}>
        <button
          aria-pressed={showInfluence}
          className={styles.influenceButton}
          disabled={!influenceSummary}
          onClick={() => onShowInfluenceChange(!showInfluence)}
          type="button"
        >
          {showInfluence ? 'Hide influence' : 'Show influence'}
        </button>
        <button
          aria-label={`Open details for ${summary.selected.label}`}
          className={styles.detailsButton}
          onClick={onOpenDetails}
          type="button"
        >
          Open details
        </button>
      </div>
    </aside>
  );
}

function SelectedView({ summary }: { summary: CropFocusSummary }) {
  return (
    <div className={styles.view}>
      <strong>{summary.selected.label}</strong>
      <p>{summary.selected.position}</p>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{summary.selected.status}</dd>
        </div>
        <div>
          <dt>Group</dt>
          <dd>{summary.selected.plantingLabel}</dd>
        </div>
      </dl>
    </div>
  );
}

function CropView({ summary }: { summary: CropFocusSummary }) {
  return (
    <div className={styles.view}>
      <strong>
        {summary.crop.nodeCount}{' '}
        {summary.crop.nodeCount === 1 ? 'plant node' : 'plant nodes'}
      </strong>
      <p>
        Across {summary.crop.plantingCount}{' '}
        {summary.crop.plantingCount === 1 ? 'group' : 'groups'}.
      </p>
      <dl>
        <div>
          <dt>Lifecycle</dt>
          <dd>{summary.crop.lifecycleSummary || 'No active plants'}</dd>
        </div>
      </dl>
    </div>
  );
}

function NeedsView({ summary }: { summary: CropFocusSummary }) {
  const items = [
    ...(summary.needs.support ? [summary.needs.support] : []),
    ...(summary.needs.sun ? [summary.needs.sun] : []),
    ...summary.needs.warnings,
    ...summary.needs.tasks,
  ];

  if (items.length === 0) {
    return (
      <div className={styles.view}>
        <strong>No urgent crop notes</strong>
        <p>Spacing, support, sun, and open tasks are quiet for this crop.</p>
      </div>
    );
  }

  return (
    <ul className={styles.needList}>
      {items.slice(0, 5).map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}
