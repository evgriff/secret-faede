import type {
  CropProfile,
  GardenPlant,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import { formatFeet } from '../../garden/gardenMath';
import { isRealWorldPlantingStatus } from '../../garden/gardenImmutability';
import type { PlanWarning } from '../../garden/gardenPlanning';
import {
  describeFootprint,
  getPlantingFootprint,
} from '../../garden/gardenPlanning';
import { getSunAreaAtPoint, type SunSeason } from '../../garden/sunShadeEngine';
import {
  describeCropSunFit,
  describeShadeSourceSummary,
} from '../../garden/sunShadeFit';
import { formatMode, formatSeason, formatSun } from './planFormatters';
import styles from './PlantEditorSheet.module.css';

type UpdatePlanting = (id: string, values: Partial<GardenPlant>) => void;

export function PlantEditorContextDetails({
  crop,
  plant,
  sunLayer,
  sunSeason,
  warnings,
}: {
  crop: CropProfile | null;
  plant: GardenPlant;
  sunLayer: SunShadeLayer;
  sunSeason: SunSeason;
  warnings: PlanWarning[];
}) {
  const footprint = getPlantingFootprint(plant);
  const sunArea = getSunAreaAtPoint(sunLayer, plant);
  const sunFit = describeCropSunFit(plant.sunRequirement, sunArea);
  const shadeSourceSummary = describeShadeSourceSummary(sunArea?.shadeSources);

  return (
    <details className={styles.details}>
      <summary>Sun, footprint, and warnings</summary>
      <dl className={styles.grid}>
        {[
          ['Crop', crop?.commonName ?? 'Custom planting'],
          ['Mode', formatMode(plant.mode)],
          [
            'Position',
            `X ${formatFeet(plant.xFt)} ft, Y ${formatFeet(plant.yFt)} ft`,
          ],
          ['Footprint', describeFootprint(footprint)],
          [
            `${formatSeason(sunSeason)} sun`,
            sunArea
              ? `${sunArea.sunHours.toFixed(1)} hr, ${formatSun(
                  sunArea.exposure,
                )}`
              : '-',
          ],
          ['Sun fit', sunFit.label],
          ['Shade source', shadeSourceSummary || '-'],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {warnings.length > 0 ? (
        <ul className={styles.warningList}>
          {warnings.slice(0, 4).map((warning) => (
            <li key={warning.id}>{warning.message}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.saved}>No active problems for this plant.</p>
      )}
    </details>
  );
}

export function PlantEditorRelocationNotice({
  onUpdatePlanting,
  plant,
}: {
  onUpdatePlanting: UpdatePlanting;
  plant: GardenPlant;
}) {
  if (!isRealWorldPlantingStatus(plant.status)) {
    return null;
  }

  return (
    <section className={styles.notice}>
      <strong>
        {plant.allowRelocation ? 'Relocation allowed' : 'Real-world anchor'}
      </strong>
      <p>
        {plant.allowRelocation
          ? 'Optimizer and Review may move this crop after explicit approval.'
          : 'Optimizer and Review keep this crop fixed unless relocation is allowed.'}
      </p>
      <button
        disabled={plant.locked}
        onClick={() =>
          onUpdatePlanting(plant.id, {
            allowRelocation: !plant.allowRelocation,
          })
        }
        type="button"
      >
        {plant.allowRelocation ? 'Stop relocation' : 'Allow relocation'}
      </button>
    </section>
  );
}
