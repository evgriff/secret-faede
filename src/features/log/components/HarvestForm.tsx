import type { FormEvent } from 'react';
import type {
  Garden,
  HarvestEvent,
} from '../../../domain/gardens/GardenRepository';
import styles from './LogForms.module.css';

type HarvestUnit = HarvestEvent['unit'];

export function HarvestForm({
  garden,
  harvestAmountText,
  harvestDate,
  harvestNotes,
  harvestPlantingId,
  harvestQuantity,
  harvestUnit,
  onSubmit,
  setHarvestAmountText,
  setHarvestDate,
  setHarvestNotes,
  setHarvestPlantingId,
  setHarvestQuantity,
  setHarvestUnit,
}: {
  garden: Garden;
  harvestAmountText: string;
  harvestDate: string;
  harvestNotes: string;
  harvestPlantingId: string;
  harvestQuantity: string;
  harvestUnit: HarvestUnit;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  setHarvestAmountText(value: string): void;
  setHarvestDate(value: string): void;
  setHarvestNotes(value: string): void;
  setHarvestPlantingId(value: string): void;
  setHarvestQuantity(value: string): void;
  setHarvestUnit(value: HarvestUnit): void;
}) {
  const quickAmounts =
    harvestUnit === 'lb' || harvestUnit === 'oz'
      ? ['0.5', '1', '2']
      : ['1', '3', '6'];

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label>
        <span>Planting</span>
        <select
          onChange={(event) => setHarvestPlantingId(event.currentTarget.value)}
          value={harvestPlantingId}
        >
          <option value="">Whole garden</option>
          {garden.plantings.map((planting) => (
            <option key={planting.id} value={planting.id}>
              {planting.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Date</span>
        <input
          onChange={(event) => setHarvestDate(event.currentTarget.value)}
          type="date"
          value={harvestDate}
        />
      </label>
      <label>
        <span>Unit</span>
        <select
          onChange={(event) =>
            setHarvestUnit(event.currentTarget.value as HarvestUnit)
          }
          value={harvestUnit}
        >
          <option value="count">Count</option>
          <option value="lb">Pounds</option>
          <option value="oz">Ounces</option>
          <option value="bunch">Bunches</option>
          <option value="freeform">Freeform</option>
        </select>
      </label>
      {harvestUnit === 'freeform' ? (
        <label>
          <span>Amount</span>
          <input
            onChange={(event) =>
              setHarvestAmountText(event.currentTarget.value)
            }
            placeholder="A basket, 3 handfuls"
            value={harvestAmountText}
          />
        </label>
      ) : (
        <>
          <label>
            <span>Quantity</span>
            <input
              min="0"
              onChange={(event) =>
                setHarvestQuantity(event.currentTarget.value)
              }
              step="0.1"
              type="number"
              value={harvestQuantity}
            />
          </label>
          <div className={styles.inlineActions}>
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => setHarvestQuantity(amount)}
                type="button"
              >
                {amount}
              </button>
            ))}
          </div>
        </>
      )}
      <label className={styles.fullWidth}>
        <span>Notes</span>
        <textarea
          onChange={(event) => setHarvestNotes(event.currentTarget.value)}
          rows={3}
          value={harvestNotes}
        />
      </label>
      <button type="submit">Log harvest</button>
    </form>
  );
}
