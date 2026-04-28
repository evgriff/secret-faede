import { useState } from 'react';
import {
  cropCatalogFilterOptions,
  type CropCatalogFilters,
} from '../../domain/crops/cropCatalog';
import type { PlantTimingStatus } from '../../domain/crops/plantCatalogTypes';
import styles from '../plan/PlanModal.module.css';
import cropStyles from './CropPickerPanels.module.css';
import {
  formatLabel,
  formatSowMethod,
  formatTimingLabel,
} from './cropPickerHelpers';

export type CategoryFilter = NonNullable<CropCatalogFilters['category']>;
export type GrowthFormFilter = NonNullable<CropCatalogFilters['growthForm']>;
export type LocationFilter = 'any' | 'fitsMyLocation';
export type SowMethodFilter = NonNullable<CropCatalogFilters['sowMethod']>;
export type SunRequirementFilter = NonNullable<
  CropCatalogFilters['sunRequirement']
>;
export type TimingFilter = 'any' | PlantTimingStatus;
export type WaterNeedsFilter = NonNullable<CropCatalogFilters['waterNeeds']>;

export function CropPickerFilters({
  category,
  growthForm,
  locationFilter,
  locationHelperText,
  onCategoryChange,
  onGrowthFormChange,
  onLocationFilterChange,
  onQueryChange,
  onSowMethodChange,
  onSunRequirementChange,
  onTimingFilterChange,
  onWaterNeedsChange,
  query,
  sowMethod,
  sunRequirement,
  timingFilter,
  waterNeeds,
}: {
  category: CategoryFilter;
  growthForm: GrowthFormFilter;
  locationFilter: LocationFilter;
  locationHelperText: string;
  onCategoryChange(value: CategoryFilter): void;
  onGrowthFormChange(value: GrowthFormFilter): void;
  onLocationFilterChange(value: LocationFilter): void;
  onQueryChange(value: string): void;
  onSowMethodChange(value: SowMethodFilter): void;
  onSunRequirementChange(value: SunRequirementFilter): void;
  onTimingFilterChange(value: TimingFilter): void;
  onWaterNeedsChange(value: WaterNeedsFilter): void;
  query: string;
  sowMethod: SowMethodFilter;
  sunRequirement: SunRequirementFilter;
  timingFilter: TimingFilter;
  waterNeeds: WaterNeedsFilter;
}) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  return (
    <>
      <label className={styles.field}>
        <span>Search crops</span>
        <input
          autoFocus
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          type="search"
          value={query}
        />
      </label>

      <div className={styles.filterGrid}>
        <label className={styles.field}>
          <span className={cropStyles.filterLabelHeader}>
            <span>Fits my location</span>
            <small className={cropStyles.filterHelpText}>
              {locationHelperText}
            </small>
          </span>
          <select
            onChange={(event) =>
              onLocationFilterChange(
                event.currentTarget.value as LocationFilter,
              )
            }
            value={locationFilter}
          >
            <option value="any">Any crop</option>
            <option value="fitsMyLocation">Only crops that fit here</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={cropStyles.filterLabelHeader}>
            <span>Planting time</span>
            <small
              aria-hidden="true"
              className={`${cropStyles.filterHelpText} ${cropStyles.filterHelpPlaceholder}`}
            >
              {locationHelperText}
            </small>
          </span>
          <select
            onChange={(event) =>
              onTimingFilterChange(event.currentTarget.value as TimingFilter)
            }
            value={timingFilter}
          >
            <option value="any">Any timing</option>
            {(
              [
                'plantNow',
                'startIndoorsNow',
                'possibleNowWithProtection',
                'waitUntilAfterFrost',
                'tooLateForSpringWindow',
                'goodForFall',
              ] as const
            ).map((option) => (
              <option key={option} value={option}>
                {formatTimingLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Sun</span>
          <select
            onChange={(event) =>
              onSunRequirementChange(
                event.currentTarget.value as SunRequirementFilter,
              )
            }
            value={sunRequirement}
          >
            <option value="any">Any</option>
            {cropCatalogFilterOptions.sunRequirements.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Water</span>
          <select
            onChange={(event) =>
              onWaterNeedsChange(event.currentTarget.value as WaterNeedsFilter)
            }
            value={waterNeeds}
          >
            <option value="any">Any</option>
            {cropCatalogFilterOptions.waterNeeds.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Crop type</span>
          <select
            onChange={(event) =>
              onCategoryChange(event.currentTarget.value as CategoryFilter)
            }
            value={category}
          >
            <option value="any">Any</option>
            {cropCatalogFilterOptions.categories.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={cropStyles.advancedFilters}>
        <div className={cropStyles.advancedFiltersHeader}>
          <button
            aria-controls="add-plant-advanced-filters"
            aria-expanded={showAdvancedFilters}
            className={cropStyles.advancedFiltersToggle}
            onClick={() => setShowAdvancedFilters((current) => !current)}
            type="button"
          >
            Advanced filters
          </button>
          <p className={cropStyles.advancedFiltersHint}>
            Growth form and sow method stay tucked away unless you need them.
          </p>
        </div>
        {showAdvancedFilters ? (
          <div
            className={cropStyles.advancedFiltersBody}
            id="add-plant-advanced-filters"
          >
            <div
              className={`${styles.filterGrid} ${cropStyles.advancedFiltersGrid}`}
            >
              <label className={styles.field}>
                <span>Growth form</span>
                <select
                  onChange={(event) =>
                    onGrowthFormChange(
                      event.currentTarget.value as GrowthFormFilter,
                    )
                  }
                  value={growthForm}
                >
                  <option value="any">Any</option>
                  {cropCatalogFilterOptions.growthForms.map((option) => (
                    <option key={option} value={option}>
                      {formatLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Sow method</span>
                <select
                  onChange={(event) =>
                    onSowMethodChange(
                      event.currentTarget.value as SowMethodFilter,
                    )
                  }
                  value={sowMethod}
                >
                  <option value="any">Any</option>
                  {cropCatalogFilterOptions.sowMethods.map((option) => (
                    <option key={option} value={option}>
                      {formatSowMethod(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
