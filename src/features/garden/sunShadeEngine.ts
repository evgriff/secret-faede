import SunCalc from 'suncalc';

import type {
  Garden,
  Plot,
  Structure,
  SunExposure,
  SunShadeArea,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';

export type SunSeason = 'fall' | 'spring' | 'summer';

export const sunSeasons: Array<{
  label: string;
  representativeDate: string;
  season: SunSeason;
}> = [
  { label: 'Spring shoulder', representativeDate: '04-15', season: 'spring' },
  { label: 'Summer peak', representativeDate: '06-21', season: 'summer' },
  { label: 'Fall shoulder', representativeDate: '09-15', season: 'fall' },
];

export const sunModelVersion = 'suncalc-shadow-v1';
const cellSizeFt = 1;
const sampleMinutes = 15;

export function buildSunShadeLayers(garden: Garden): SunShadeLayer[] {
  const generatedAtIso = new Date().toISOString();
  const modeledLayers = sunSeasons.map(
    ({ label, representativeDate, season }) =>
      buildSunShadeLayer(garden, {
        generatedAtIso,
        label,
        representativeDate,
        season,
      }),
  );

  return mergeManualOverrides(modeledLayers, garden.sunShadeLayers);
}

export function buildSunShadeLayer(
  garden: Garden,
  options: {
    generatedAtIso: string | null;
    label: string;
    representativeDate: string;
    season: SunSeason;
  },
): SunShadeLayer {
  const location = garden.plot.location;
  const latitude = location.latitude ?? 42.3314;
  const longitude = location.longitude ?? -83.0458;
  const sampleTimes = createSampleTimes(options.representativeDate);
  const areas: SunShadeArea[] = [];

  for (let yFt = 0; yFt < garden.plot.depthFt; yFt += cellSizeFt) {
    for (let xFt = 0; xFt < garden.plot.widthFt; xFt += cellSizeFt) {
      const cellCenter = {
        xFt: xFt + cellSizeFt / 2,
        yFt: yFt + cellSizeFt / 2,
      };
      const sunHours = sampleTimes.reduce((total, date) => {
        const position = SunCalc.getPosition(date, latitude, longitude);

        if (position.altitude <= 0) {
          return total;
        }

        return isCellShaded(
          cellCenter,
          garden.structures,
          garden.plot,
          position,
        )
          ? total
          : total + sampleMinutes / 60;
      }, 0);

      areas.push({
        depthFt: cellSizeFt,
        exposure: classifySunHours(sunHours),
        id: `${options.season}-${xFt}-${yFt}`,
        source: 'modeled',
        sunHours: Number(sunHours.toFixed(2)),
        widthFt: cellSizeFt,
        xFt,
        yFt,
      });
    }
  }

  return {
    areas,
    cellSizeFt,
    fullSunHours: null,
    gardenId: garden.id,
    generatedAtIso: options.generatedAtIso,
    id: `sun-${options.season}`,
    label: options.label,
    modelVersion: sunModelVersion,
    observedOn: null,
    representativeDate: options.representativeDate,
    season: options.season,
  };
}

export function findSunShadeLayer(
  garden: Garden,
  season: SunSeason,
): SunShadeLayer {
  return (
    garden.sunShadeLayers.find((layer) => layer.season === season) ??
    buildSunShadeLayer(garden, {
      generatedAtIso: null,
      label:
        sunSeasons.find((entry) => entry.season === season)?.label ?? season,
      representativeDate:
        sunSeasons.find((entry) => entry.season === season)
          ?.representativeDate ?? '06-21',
      season,
    })
  );
}

export function getSunAreaAtPoint(
  layer: SunShadeLayer,
  point: { xFt: number; yFt: number },
) {
  return (
    layer.areas.find(
      (area) =>
        point.xFt >= area.xFt &&
        point.xFt < area.xFt + area.widthFt &&
        point.yFt >= area.yFt &&
        point.yFt < area.yFt + area.depthFt,
    ) ?? null
  );
}

export function cropSunRequirementMet(
  required: SunExposure | null,
  actual: SunExposure | null,
) {
  if (!required || !actual) {
    return true;
  }

  return exposureScore(actual) >= exposureScore(required);
}

export function createManualSunArea(
  season: SunSeason,
  xFt: number,
  yFt: number,
  exposure: SunExposure,
): SunShadeArea {
  return {
    depthFt: cellSizeFt,
    exposure,
    id: `${season}-${Math.floor(xFt)}-${Math.floor(yFt)}`,
    source: 'manual',
    sunHours: manualSunHours(exposure),
    widthFt: cellSizeFt,
    xFt: Math.floor(xFt),
    yFt: Math.floor(yFt),
  };
}

function createSampleTimes(representativeDate: string) {
  const [month, day] = representativeDate.split('-').map(Number);
  const sampleTimes: Date[] = [];

  for (let hour = 5; hour <= 21; hour += 1) {
    for (let minute = 0; minute < 60; minute += sampleMinutes) {
      sampleTimes.push(
        new Date(2026, (month ?? 6) - 1, day ?? 21, hour, minute),
      );
    }
  }

  return sampleTimes;
}

function isCellShaded(
  cell: { xFt: number; yFt: number },
  structures: Structure[],
  plot: Plot,
  sunPosition: { altitude: number; azimuth: number },
) {
  const shadowDirection = getShadowDirection(sunPosition.azimuth, plot);

  return structures.some((structure) => {
    if (!castsShade(structure)) {
      return false;
    }

    const center = {
      xFt: structure.xFt + structure.widthFt / 2,
      yFt: structure.yFt + structure.depthFt / 2,
    };
    const dx = cell.xFt - center.xFt;
    const dy = cell.yFt - center.yFt;
    const projection = dx * shadowDirection.x + dy * shadowDirection.y;
    const perpendicular = Math.abs(
      dx * -shadowDirection.y + dy * shadowDirection.x,
    );
    const heightFt = structure.heightFt ?? 0;
    const shadowLengthFt = Math.min(
      heightFt / Math.tan(Math.max(sunPosition.altitude, 0.1)),
      Math.max(plot.widthFt, plot.depthFt) * 2,
    );
    const shadowWidthFt =
      Math.max(structure.widthFt, structure.depthFt) / 2 +
      (structure.canopyRadiusFt ?? 0);

    return (
      projection >= 0 &&
      projection <= shadowLengthFt &&
      perpendicular <= Math.max(shadowWidthFt, 0.5)
    );
  });
}

function castsShade(structure: Structure) {
  return (
    (structure.heightFt ?? 0) > 0 &&
    [
      'compost',
      'container',
      'fence',
      'fenceWall',
      'other',
      'raisedBed',
      'treeObstacle',
      'trellis',
      'waterSource',
    ].includes(structure.type)
  );
}

function getShadowDirection(azimuth: number, plot: Plot) {
  const sunAzimuthFromNorth = azimuth + Math.PI;
  const shadowAzimuth = sunAzimuthFromNorth + Math.PI;
  const plotRotation = (plot.orientationDegrees * Math.PI) / 180;
  const angle = shadowAzimuth + plotRotation;

  return {
    x: Math.sin(angle),
    y: -Math.cos(angle),
  };
}

function classifySunHours(sunHours: number): SunExposure {
  if (sunHours >= 6) {
    return 'fullSun';
  }

  if (sunHours >= 4) {
    return 'partSun';
  }

  if (sunHours >= 2) {
    return 'partShade';
  }

  return 'fullShade';
}

function mergeManualOverrides(
  modeledLayers: SunShadeLayer[],
  previousLayers: SunShadeLayer[],
) {
  return modeledLayers.map((layer) => {
    const previousLayer = previousLayers.find(
      (candidate) => candidate.season === layer.season,
    );
    const manualAreas =
      previousLayer?.areas.filter((area) => area.source === 'manual') ?? [];

    if (manualAreas.length === 0) {
      return layer;
    }

    return {
      ...layer,
      areas: layer.areas.map((area) => {
        const manualArea = manualAreas.find(
          (candidate) =>
            candidate.xFt === area.xFt && candidate.yFt === area.yFt,
        );

        return manualArea ?? area;
      }),
    };
  });
}

function exposureScore(exposure: SunExposure) {
  switch (exposure) {
    case 'fullSun':
      return 4;
    case 'partSun':
      return 3;
    case 'partShade':
      return 2;
    case 'fullShade':
      return 1;
  }
}

function manualSunHours(exposure: SunExposure) {
  switch (exposure) {
    case 'fullSun':
      return 7;
    case 'partSun':
      return 5;
    case 'partShade':
      return 3;
    case 'fullShade':
      return 1;
  }
}
