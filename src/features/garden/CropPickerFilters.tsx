import {
  cropCatalogFilterOptions,
  type CropCatalogFilters,
} from '../../domain/crops/cropCatalog';
import styles from '../plan/PlanModal.module.css';
import { formatLabel, formatSowMethod } from './cropPickerHelpers';

export type CategoryFilter = NonNullable<CropCatalogFilters['category']>;
export type GrowthFormFilter = NonNullable<CropCatalogFilters['growthForm']>;
export type SowMethodFilter = NonNullable<CropCatalogFilters['sowMethod']>;
export type SunRequirementFilter = NonNullable<
  CropCatalogFilters['sunRequirement']
>;
export type WaterNeedsFilter = NonNullable<CropCatalogFilters['waterNeeds']>;

export function CropPickerFilters({
  category,
  growthForm,
  onCategoryChange,
  onGrowthFormChange,
  onQueryChange,
  onSowMethodChange,
  onSunRequirementChange,
  onWaterNeedsChange,
  query,
  sowMethod,
  sunRequirement,
  waterNeeds,
}: {
  category: CategoryFilter;
  growthForm: GrowthFormFilter;
  onCategoryChange(value: CategoryFilter): void;
  onGrowthFormChange(value: GrowthFormFilter): void;
  onQueryChange(value: string): void;
  onSowMethodChange(value: SowMethodFilter): void;
  onSunRequirementChange(value: SunRequirementFilter): void;
  onWaterNeedsChange(value: WaterNeedsFilter): void;
  query: string;
  sowMethod: SowMethodFilter;
  sunRequirement: SunRequirementFilter;
  waterNeeds: WaterNeedsFilter;
}) {
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
          <span>Category</span>
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
          <span>Form</span>
          <select
            onChange={(event) =>
              onGrowthFormChange(event.currentTarget.value as GrowthFormFilter)
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
          <span>Sow</span>
          <select
            onChange={(event) =>
              onSowMethodChange(event.currentTarget.value as SowMethodFilter)
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
    </>
  );
}
