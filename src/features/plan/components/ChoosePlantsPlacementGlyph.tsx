import type { PlantingMode } from '../../../domain/gardens/GardenRepository';
import styles from './ChoosePlantsCompact.module.css';

export function PlacementGlyph({ mode }: { mode: PlantingMode }) {
  const placementMode =
    mode === 'block' ? 'block' : mode === 'cluster' ? 'cluster' : 'row';

  return (
    <span
      aria-hidden="true"
      className={styles.placementGlyph}
      data-placement-mode={placementMode}
    >
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
