import {
  cropCatalogFilterOptions,
  type CropCatalogFilters,
} from '../../../domain/crops/cropCatalog';
import type { PlantLocationMatchBand } from '../../../domain/crops/plantCatalog';
import { formatLabel } from '../../garden/cropPickerHelpers';
import sharedStyles from '../PlanModal.module.css';
import styles from './ChoosePlantsModal.module.css';

export type CategoryFilter = NonNullable<CropCatalogFilters['category']>;
export type LifecycleFilter = NonNullable<CropCatalogFilters['lifecycle']>;
export type LocationMatchFilter = PlantLocationMatchBand | 'any';
export type SunRequirementFilter = NonNullable<
  CropCatalogFilters['sunRequirement']
>;
export type WaterNeedsFilter = NonNullable<CropCatalogFilters['waterNeeds']>;

export function ChoosePlantsFilters({
  category,
  lifecycle,
  locationMatch,
  onCategoryChange,
  onLifecycleChange,
  onLocationMatchChange,
  onQueryChange,
  onSunRequirementChange,
  onWaterNeedsChange,
  query,
  sunRequirement,
  waterNeeds,
}: {
  category: CategoryFilter;
  lifecycle: LifecycleFilter;
  locationMatch: LocationMatchFilter;
  onCategoryChange(value: CategoryFilter): void;
  onLifecycleChange(value: LifecycleFilter): void;
  onLocationMatchChange(value: LocationMatchFilter): void;
  onQueryChange(value: string): void;
  onSunRequirementChange(value: SunRequirementFilter): void;
  onWaterNeedsChange(value: WaterNeedsFilter): void;
  query: string;
  sunRequirement: SunRequirementFilter;
  waterNeeds: WaterNeedsFilter;
}) {
  return (
    <>
      <label className={sharedStyles.field}>
        <span>Search plants</span>
        <input
          autoFocus
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          type="search"
          value={query}
        />
      </label>

      <div className={styles.filters}>
        <label className={sharedStyles.field}>
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

        <label className={sharedStyles.field}>
          <span>Lifecycle</span>
          <select
            onChange={(event) =>
              onLifecycleChange(event.currentTarget.value as LifecycleFilter)
            }
            value={lifecycle}
          >
            <option value="any">Any</option>
            {cropCatalogFilterOptions.lifecycles.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className={sharedStyles.field}>
          <span>Location Match</span>
          <select
            onChange={(event) =>
              onLocationMatchChange(
                event.currentTarget.value as LocationMatchFilter,
              )
            }
            value={locationMatch}
          >
            <option value="any">Any</option>
            <option value="strong">Strong</option>
            <option value="good">Good</option>
            <option value="watch">Watch</option>
            <option value="poor">Poor</option>
          </select>
        </label>

        <label className={sharedStyles.field}>
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

        <label className={sharedStyles.field}>
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
      </div>
    </>
  );
}
