import { memo, useCallback, useState } from 'react';

import type {
  SunExposure,
  SunShadeArea,
} from '../../../domain/gardens/GardenRepository';
import { describeShadeSourceSummary } from '../../garden/sunShadeFit';
import { type SunSeason } from '../../garden/sunShadeEngine';
import { sunAreaStyle } from './planCanvasGeometry';
import styles from './PlanCanvasItems.module.css';

export const PlanSunOverlay = memo(function PlanSunOverlay({
  activeSunLayer,
  manualSunEdit,
  manualSunExposure,
  onPaintSunShadeCell,
  sunSeason,
}: {
  activeSunLayer: { areas: SunShadeArea[] };
  manualSunEdit: boolean;
  manualSunExposure: SunExposure;
  onPaintSunShadeCell(
    season: SunSeason,
    xFt: number,
    yFt: number,
    exposure: SunExposure,
  ): void;
  sunSeason: SunSeason;
}) {
  const [isPainting, setIsPainting] = useState(false);

  const paint = useCallback(
    (area: SunShadeArea) => {
      if (manualSunEdit) {
        onPaintSunShadeCell(sunSeason, area.xFt, area.yFt, manualSunExposure);
      }
    },
    [manualSunEdit, manualSunExposure, onPaintSunShadeCell, sunSeason],
  );

  return (
    <div
      className={styles.sunOverlay}
      aria-hidden={!manualSunEdit}
      onPointerLeave={() => setIsPainting(false)}
    >
      {activeSunLayer.areas.map((area) => (
        <SunCell
          area={area}
          isPainting={isPainting}
          key={area.id}
          manualSunEdit={manualSunEdit}
          onPaint={paint}
          onPaintingChange={setIsPainting}
        />
      ))}
    </div>
  );
});

const SunCell = memo(function SunCell({
  area,
  isPainting,
  manualSunEdit,
  onPaint,
  onPaintingChange,
}: {
  area: SunShadeArea;
  isPainting: boolean;
  manualSunEdit: boolean;
  onPaint(area: SunShadeArea): void;
  onPaintingChange(value: boolean): void;
}) {
  const className = `${styles.sunCell} ${styles[area.exposure]} ${
    area.source === 'manual' ? styles.manualSunCell : ''
  }`;
  const style = sunAreaStyle(area);
  const title = describeSunCell(area);
  const contents = (
    <>
      <span aria-hidden="true" className={styles.sunHours}>
        {area.sunHours.toFixed(1)}h
      </span>
      {area.source === 'manual' ? (
        <span aria-hidden="true" className={styles.manualMark}>
          M
        </span>
      ) : null}
      {area.microclimateNotes?.length ? (
        <span aria-hidden="true" className={styles.microclimateMark}>
          i
        </span>
      ) : null}
    </>
  );

  if (!manualSunEdit) {
    return (
      <div aria-hidden="true" className={className} style={style} title={title}>
        {contents}
      </div>
    );
  }

  return (
    <button
      aria-label={`Sun cell ${area.xFt}, ${area.yFt}`}
      className={className}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPaint(area);
        }
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        onPaintingChange(true);
        onPaint(area);
      }}
      onPointerEnter={() => {
        if (isPainting) {
          onPaint(area);
        }
      }}
      onPointerUp={() => onPaintingChange(false)}
      style={style}
      title={title}
      type="button"
    >
      {contents}
    </button>
  );
});

function formatExposure(exposure: SunExposure) {
  return exposure.replace(/([A-Z])/g, ' $1').toLowerCase();
}

function describeSunCell(area: SunShadeArea) {
  const parts = [
    `${formatExposure(area.exposure)} - ${area.sunHours.toFixed(1)} direct-sun hours`,
    area.source === 'manual' ? 'manual observation' : 'modeled estimate',
  ];

  const shadeSummary = describeShadeSourceSummary(area.shadeSources);

  if (shadeSummary) {
    parts.push(`Shade source: ${shadeSummary}`);
  }

  if (area.microclimateNotes?.length) {
    parts.push(
      `Microclimate: ${area.microclimateNotes
        .map((note) => note.label)
        .join(', ')}`,
    );
  }

  if (area.source === 'manual') {
    parts.push('manual observation');
  }

  return parts.join(' - ');
}
