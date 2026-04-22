import type {
  SunExposure,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import { sunSeasons, type SunSeason } from '../../garden/sunShadeEngine';
import styles from './PlanModeDrawer.module.css';

export function PlanSunControls({
  activeSunLayer,
  manualSunEdit,
  manualSunExposure,
  onRecalculateSun,
  setManualSunEdit,
  setManualSunExposure,
  setShowSunOverlay,
  setSunSeason,
  showSunOverlay,
  sunSeason,
}: {
  activeSunLayer: SunShadeLayer;
  manualSunEdit: boolean;
  manualSunExposure: SunExposure;
  onRecalculateSun(): void;
  setManualSunEdit(value: boolean): void;
  setManualSunExposure(value: SunExposure): void;
  setShowSunOverlay(value: boolean): void;
  setSunSeason(value: SunSeason): void;
  showSunOverlay: boolean;
  sunSeason: SunSeason;
}) {
  const areas = activeSunLayer.areas;
  const manualCount = areas.filter((area) => area.source === 'manual').length;
  const shadeSourceCellCount = areas.filter(
    (area) => area.shadeSources?.length,
  ).length;
  const averageSunHours =
    areas.length === 0
      ? 0
      : areas.reduce((total, area) => total + area.sunHours, 0) / areas.length;

  return (
    <div className={styles.sunControls}>
      <button
        className={styles.secondaryButton}
        onClick={onRecalculateSun}
        type="button"
      >
        Recalculate sun
      </button>
      <div className={styles.seasonTabs} aria-label="Sun season">
        {sunSeasons.map((entry) => (
          <button
            aria-pressed={sunSeason === entry.season}
            className={sunSeason === entry.season ? styles.activeSeason : ''}
            key={entry.season}
            onClick={() => setSunSeason(entry.season)}
            type="button"
          >
            <strong>{formatSeasonLabel(entry.season)}</strong>
            <span>{formatRepresentativeDate(entry.representativeDate)}</span>
          </button>
        ))}
      </div>
      <label>
        <input
          checked={showSunOverlay}
          onChange={(event) => setShowSunOverlay(event.currentTarget.checked)}
          type="checkbox"
        />{' '}
        Sun layer
      </label>
      <div className={styles.sunSummary} aria-label="Sun estimate summary">
        <span>
          <strong>{averageSunHours.toFixed(1)} hr</strong> avg direct sun
        </span>
        <span>
          <strong>{manualCount}</strong> observed cell
          {manualCount === 1 ? '' : 's'}
        </span>
        <span>
          <strong>{shadeSourceCellCount}</strong> shade-source cell
          {shadeSourceCellCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className={styles.sunLegend} aria-label="Direct sun hour legend">
        {paintOptions.map((option) => (
          <span key={option.value}>
            <i className={styles[option.value]} aria-hidden="true" />
            <strong>{option.label}</strong> {getExposureRange(option.value)}
          </span>
        ))}
      </div>
      <div className={styles.calibrationPanel}>
        <span>
          Manual observations:{' '}
          <strong>{formatObservedOn(activeSunLayer.observedOn)}</strong>
        </span>
        <span>Observed cells override modeled cells during refresh.</span>
      </div>
      <label>
        <input
          checked={manualSunEdit}
          disabled={!showSunOverlay}
          onChange={(event) => setManualSunEdit(event.currentTarget.checked)}
          type="checkbox"
        />{' '}
        Paint
      </label>
      <select
        aria-label="Manual sun exposure"
        disabled={!manualSunEdit}
        onChange={(event) =>
          setManualSunExposure(event.currentTarget.value as SunExposure)
        }
        value={manualSunExposure}
      >
        <option value="fullSun">Full sun</option>
        <option value="partSun">Part sun</option>
        <option value="partShade">Part shade</option>
        <option value="fullShade">Full shade</option>
      </select>
      <div className={styles.paintSwatches} aria-label="Sun paint presets">
        {paintOptions.map((option) => (
          <button
            aria-pressed={manualSunExposure === option.value}
            className={
              manualSunExposure === option.value ? styles.activeSwatch : ''
            }
            disabled={!manualSunEdit}
            key={option.value}
            onClick={() => setManualSunExposure(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const paintOptions: Array<{ label: string; value: SunExposure }> = [
  { label: 'Full sun', value: 'fullSun' },
  { label: 'Part sun', value: 'partSun' },
  { label: 'Part shade', value: 'partShade' },
  { label: 'Full shade', value: 'fullShade' },
];

function formatSeasonLabel(season: SunSeason) {
  return season.replace(/^./, (letter) => letter.toUpperCase());
}

function getExposureRange(exposure: SunExposure) {
  switch (exposure) {
    case 'fullSun':
      return '6+ direct hr';
    case 'partSun':
      return '4-6 direct hr';
    case 'partShade':
      return '2-4 direct hr';
    case 'fullShade':
      return '<2 direct hr';
  }
}

function formatObservedOn(value: string | null) {
  return value ?? 'not calibrated';
}

function formatRepresentativeDate(value: string) {
  const [month, day] = value.split('-');

  return `${month}/${day}`;
}
