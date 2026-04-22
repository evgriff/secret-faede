import { SegmentedControl } from '../../shared/design/DesignPrimitives';
import type { LogFeedFilterOptions } from '../logFeedItems';
import type {
  IssueStatusFilter,
  LogFeedTypeFilter,
  LogFilterState,
} from '../logSelectors';
import { formatIssueStatus } from '../logHelpers';
import styles from './LogFilters.module.css';

const typeFilters: Array<{ label: string; value: LogFeedTypeFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Notes', value: 'note' },
  { label: 'Issues', value: 'issue' },
  { label: 'Harvests', value: 'harvest' },
  { label: 'Water', value: 'watering' },
  { label: 'Tasks', value: 'task' },
  { label: 'Photos', value: 'photo' },
];

const issueStatuses: IssueStatusFilter[] = [
  'all',
  'open',
  'inProgress',
  'resolved',
];

export function LogFilters({
  filterOptions,
  filters,
  onFiltersChange,
}: {
  filterOptions: LogFeedFilterOptions;
  filters: LogFilterState;
  onFiltersChange(filters: LogFilterState): void;
}) {
  const hasActiveFilters =
    filters.query ||
    (filters.type ?? 'all') !== 'all' ||
    (filters.cropId ?? 'all') !== 'all' ||
    (filters.bedId ?? 'all') !== 'all' ||
    (filters.season ?? 'all') !== 'all' ||
    filters.issueStatus !== 'all';

  return (
    <section className={styles.filterPanel}>
      <div className={styles.filterToolbar}>
        <SegmentedControl
          label="Feed type"
          onChange={(type) => onFiltersChange({ ...filters, type })}
          options={typeFilters}
          value={filters.type ?? 'all'}
        />
        <label>
          <span>Search</span>
          <input
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                query: event.currentTarget.value,
              })
            }
            placeholder="Crop, bed, issue, note"
            type="search"
            value={filters.query}
          />
        </label>
        {hasActiveFilters ? (
          <button
            className={styles.clearButton}
            onClick={() =>
              onFiltersChange({
                bedId: 'all',
                cropId: 'all',
                issueStatus: 'all',
                query: '',
                season: 'all',
                targetId: 'all',
                type: 'all',
              })
            }
            type="button"
          >
            Clear
          </button>
        ) : null}
      </div>
      <details className={styles.advancedFilters}>
        <summary>Crop, bed, season</summary>
        <div className={styles.filterGrid}>
          <label>
            <span>Crop</span>
            <select
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  cropId: event.currentTarget.value,
                })
              }
              value={filters.cropId ?? 'all'}
            >
              <option value="all">All crops</option>
              {filterOptions.crops.map((crop) => (
                <option key={crop.id} value={crop.id}>
                  {crop.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Bed</span>
            <select
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  bedId: event.currentTarget.value,
                })
              }
              value={filters.bedId ?? 'all'}
            >
              <option value="all">All beds</option>
              {filterOptions.beds.map((bed) => (
                <option key={bed.id} value={bed.id}>
                  {bed.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Season</span>
            <select
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  season: event.currentTarget.value,
                })
              }
              value={filters.season ?? 'all'}
            >
              <option value="all">All seasons</option>
              {filterOptions.seasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Issue status</span>
            <select
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  issueStatus: event.currentTarget.value as IssueStatusFilter,
                })
              }
              value={filters.issueStatus}
            >
              {issueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'all'
                    ? 'All statuses'
                    : formatIssueStatus(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </section>
  );
}
