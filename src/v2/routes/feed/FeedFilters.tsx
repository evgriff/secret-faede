import { Button } from '../../ui';
import { emptyFeedFilters } from './feedModel';
import styles from './FeedPage.module.css';
import type {
  FeedActivityStatus,
  FeedActivityType,
  FeedFiltersValue,
  FeedTargetOption,
} from './types';

const types: Array<{ label: string; value: 'all' | FeedActivityType }> = [
  { label: 'All activity', value: 'all' },
  { label: 'Notes', value: 'note' },
  { label: 'Issues', value: 'issue' },
  { label: 'Photos', value: 'photo' },
  { label: 'Harvests', value: 'harvest' },
  { label: 'Watering', value: 'watering' },
];

const statuses: Array<{
  label: string;
  value: 'all' | Exclude<FeedActivityStatus, null>;
}> = [
  { label: 'All statuses', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In progress', value: 'inProgress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Water due', value: 'due' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Suppressed', value: 'suppressed' },
  { label: 'Check soil', value: 'checkSoil' },
  { label: 'Water applied', value: 'applied' },
  { label: 'Water partially applied', value: 'partial' },
  { label: 'Water skipped', value: 'skipped' },
];

export function FeedFilters({
  filters,
  onChange,
  targets,
}: {
  filters: FeedFiltersValue;
  onChange(filters: FeedFiltersValue): void;
  targets: readonly FeedTargetOption[];
}) {
  return (
    <section aria-labelledby="feed-filters-title" className={styles.filters}>
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="feed-filters-title">Find a memory</h2>
          <p>Search the private stream or narrow it by target and status.</p>
        </div>
        <Button
          disabled={isEmpty(filters)}
          onClick={() => onChange(emptyFeedFilters)}
          variant="quiet"
        >
          Clear filters
        </Button>
      </div>
      <div className={styles.filterGrid}>
        <label className={styles.field}>
          <span>Search</span>
          <input
            onChange={(event) =>
              onChange({ ...filters, query: event.currentTarget.value })
            }
            placeholder="Crop, bed, note, or reason"
            type="search"
            value={filters.query}
          />
        </label>
        <label className={styles.field}>
          <span>Type</span>
          <select
            onChange={(event) =>
              onChange({
                ...filters,
                type: event.currentTarget.value as FeedFiltersValue['type'],
              })
            }
            value={filters.type}
          >
            {types.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Target</span>
          <select
            onChange={(event) =>
              onChange({
                ...filters,
                targetValue: event.currentTarget.value,
              })
            }
            value={filters.targetValue}
          >
            <option value="all">All garden targets</option>
            {targets.map((option) => (
              <option key={option.value} value={option.value}>
                {option.target.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select
            onChange={(event) =>
              onChange({
                ...filters,
                status: event.currentTarget.value as FeedFiltersValue['status'],
              })
            }
            value={filters.status}
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function isEmpty(filters: FeedFiltersValue) {
  return (
    filters.query === '' &&
    filters.status === 'all' &&
    filters.targetValue === 'all' &&
    filters.type === 'all'
  );
}
