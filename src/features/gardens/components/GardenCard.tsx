import { GardenGlyphIcon } from '../../../assets/icons/GardenIcons';
import { BotanicalDivider } from '../../../assets/illustrations/GardenIllustrations';
import type { GardenSummary } from '../../../domain/gardens/types';
import styles from './GardenCard.module.css';

interface GardenCardProps {
  garden: GardenSummary;
  isSelected: boolean;
  onSelect(gardenId: string): void;
}

export function GardenCard({ garden, isSelected, onSelect }: GardenCardProps) {
  return (
    <article className={`${styles.card} ${isSelected ? styles.selected : ''}`}>
      <div className={styles.header}>
        <div>
          <GardenGlyphIcon
            accentColor="var(--color-plant-green)"
            className={styles.icon}
            size={24}
            title={`${garden.name} glyph`}
          />
          <h2 className={styles.title}>{garden.name}</h2>
          <p className="pageLead">{garden.updatedLabel}</p>
        </div>
        <span className={styles.chip}>{garden.memberRole}</span>
      </div>
      <ul className={styles.meta}>
        <li>
          {garden.dimensions.width}×{garden.dimensions.height}{' '}
          {garden.dimensions.unit}
        </li>
        <li>{garden.plotCount} plots</li>
        <li>{garden.timezone}</li>
      </ul>
      <BotanicalDivider className={styles.divider} size="100%" />
      <button
        className={styles.button}
        onClick={() => onSelect(garden.id)}
        type="button"
      >
        {isSelected ? 'Open selected garden' : 'Select garden'}
      </button>
    </article>
  );
}
