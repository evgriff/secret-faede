import { PlantIcon } from './PlantIcon';
import styles from './GardenEditorScreen.module.css';

interface AddPlantModalProps {
  onAddPlant(): void;
  onClose(): void;
}

export function AddPlantModal({ onAddPlant, onClose }: AddPlantModalProps) {
  return (
    <div className={styles.modalBackdrop}>
      <section
        aria-labelledby="add-plant-title"
        aria-modal="true"
        className={styles.modal}
        role="dialog"
      >
        <div className={styles.modalHeader}>
          <h2 id="add-plant-title">Add Plant</h2>
          <button
            aria-label="Close"
            className={styles.iconButton}
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>
        <PlantIcon className={styles.modalPlantIcon} />
        <button
          className={styles.primaryButton}
          onClick={onAddPlant}
          type="button"
        >
          Add Plant
        </button>
      </section>
    </div>
  );
}
