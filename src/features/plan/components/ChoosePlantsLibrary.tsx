import { useMemo, useState } from 'react';

import {
  cropCatalogFilterOptions,
  filterCropCatalog,
  type CropCatalogFilters,
} from '../../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import { CropResultFacts } from '../../garden/CropPickerPanels';
import {
  formatCropFamilyLine,
  formatGlyph,
  formatLabel,
  getCropIconTone,
} from '../../garden/cropPickerHelpers';
import { VirtualCropResultList } from '../../garden/VirtualCropResultList';
import { getSeasonCropFitSignal } from '../seasonCropPlan';
import sharedStyles from '../PlanModal.module.css';
import styles from './ChoosePlantsModal.module.css';
import { createSeasonCropSelection } from './choosePlantsSelection';

type CategoryFilter = NonNullable<CropCatalogFilters['category']>;
type SunRequirementFilter = NonNullable<CropCatalogFilters['sunRequirement']>;
type WaterNeedsFilter = NonNullable<CropCatalogFilters['waterNeeds']>;

export function ChoosePlantsLibrary({
  compareCropIds,
  garden,
  onAddCrop,
  onToggleCompare,
  selectedCropIds,
  sunExposureAtPlacement,
}: {
  compareCropIds: string[];
  garden: Garden;
  onAddCrop(crop: CropProfile): void;
  onToggleCompare(crop: CropProfile): void;
  selectedCropIds: Set<string>;
  sunExposureAtPlacement: SunExposure | null;
}) {
  const [category, setCategory] = useState<CategoryFilter>('any');
  const [query, setQuery] = useState('');
  const [sunRequirement, setSunRequirement] =
    useState<SunRequirementFilter>('any');
  const [waterNeeds, setWaterNeeds] = useState<WaterNeedsFilter>('any');
  const filteredCrops = useMemo(
    () =>
      filterCropCatalog({
        category,
        query,
        sunRequirement,
        waterNeeds,
      }),
    [category, query, sunRequirement, waterNeeds],
  );

  return (
    <section className={styles.library} aria-label="Plant library">
      <label className={sharedStyles.field}>
        <span>Search plants</span>
        <input
          autoFocus
          onChange={(event) => setQuery(event.currentTarget.value)}
          type="search"
          value={query}
        />
      </label>

      <div className={styles.filters}>
        <label className={sharedStyles.field}>
          <span>Category</span>
          <select
            onChange={(event) =>
              setCategory(event.currentTarget.value as CategoryFilter)
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
          <span>Sun</span>
          <select
            onChange={(event) =>
              setSunRequirement(
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
              setWaterNeeds(event.currentTarget.value as WaterNeedsFilter)
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

      <VirtualCropResultList
        className={styles.results}
        crops={filteredCrops}
        empty={<p className={styles.emptyText}>No matching plants.</p>}
        itemHeightPx={122}
        renderCrop={(crop) => (
          <CropLibraryResult
            compareDisabled={
              compareCropIds.length >= 3 && !compareCropIds.includes(crop.id)
            }
            crop={crop}
            garden={garden}
            isComparing={compareCropIds.includes(crop.id)}
            isSelected={selectedCropIds.has(crop.id)}
            onAdd={() => onAddCrop(crop)}
            onToggleCompare={() => onToggleCompare(crop)}
            sunExposureAtPlacement={sunExposureAtPlacement}
          />
        )}
      />
    </section>
  );
}

function CropLibraryResult({
  compareDisabled,
  crop,
  garden,
  isComparing,
  isSelected,
  onAdd,
  onToggleCompare,
  sunExposureAtPlacement,
}: {
  compareDisabled: boolean;
  crop: CropProfile;
  garden: Garden;
  isComparing: boolean;
  isSelected: boolean;
  onAdd(): void;
  onToggleCompare(): void;
  sunExposureAtPlacement: SunExposure | null;
}) {
  const fit = getSeasonCropFitSignal({
    crop,
    garden,
    selection: createSeasonCropSelection(crop),
    sunExposureAtPlacement,
  });
  return (
    <article className={styles.resultCard}>
      <span
        className={styles.cropGlyph}
        data-crop-tone={getCropIconTone(crop)}
        aria-hidden="true"
      >
        {formatGlyph(crop)}
      </span>
      <div className={styles.resultBody}>
        <strong>{crop.commonName}</strong>
        <span className={styles.resultMeta}>{formatCropFamilyLine(crop)}</span>
        <span className={styles.resultFit}>{fit.summary}</span>
        <CropResultFacts crop={crop} />
      </div>
      <div className={styles.resultActions}>
        <button
          aria-label={
            isComparing
              ? `Remove ${crop.commonName} from compare`
              : `Compare ${crop.commonName}`
          }
          className={sharedStyles.secondaryButton}
          disabled={compareDisabled}
          onClick={onToggleCompare}
          type="button"
        >
          {isComparing ? 'Comparing' : 'Compare'}
        </button>
        <button
          aria-label={
            isSelected ? `${crop.commonName} added` : `Add ${crop.commonName}`
          }
          className={sharedStyles.secondaryButton}
          disabled={isSelected}
          onClick={onAdd}
          type="button"
        >
          {isSelected ? 'Added' : 'Add'}
        </button>
      </div>
    </article>
  );
}
