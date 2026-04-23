import SunCalc from 'suncalc';

import type {
  Garden,
  SunExposure,
  SunShadeArea,
  SunShadeLayer,
  SunShadeMicroclimateNote,
  SunShadeSource,
} from '../../domain/gardens/GardenRepository';
import {
  buildMicroclimateNotes,
  buildShadeCasters,
  getCellShadeHits,
  getShadePressure,
} from './sunShadeModeling';

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

export const sunModelVersion = 'suncalc-maturity-shadow-v3';
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
  const shadeCasters = buildShadeCasters(garden);
  const areas: SunShadeArea[] = [];

  for (let yFt = 0; yFt < garden.plot.depthFt; yFt += cellSizeFt) {
    for (let xFt = 0; xFt < garden.plot.widthFt; xFt += cellSizeFt) {
      const cellCenter = {
        xFt: xFt + cellSizeFt / 2,
        yFt: yFt + cellSizeFt / 2,
      };
      const shadeSources = new Map<string, SunShadeSource>();
      const sunHours = sampleTimes.reduce((total, date) => {
        const position = SunCalc.getPosition(date, latitude, longitude);

        if (position.altitude <= 0) {
          return total;
        }

        const shadeHits = getCellShadeHits(
          cellCenter,
          shadeCasters,
          garden.plot,
          position,
        );

        if (shadeHits.length > 0) {
          const shadePressure = getShadePressure(shadeHits);

          shadeHits.forEach((hit) =>
            shadeSources.set(`${hit.source.itemType}:${hit.source.itemId}`, {
              ...hit.source,
            }),
          );
          return total + (sampleMinutes / 60) * (1 - shadePressure);
        }

        return total + sampleMinutes / 60;
      }, 0);
      const sources = [...shadeSources.values()].slice(0, 4);
      const microclimateNotes = buildMicroclimateNotes({
        cell: cellCenter,
        garden,
        shadeSources: sources,
        sunHours,
      });

      areas.push(
        withAreaMetadata(
          {
            depthFt: cellSizeFt,
            exposure: classifySunHours(sunHours),
            id: `${options.season}-${xFt}-${yFt}`,
            source: 'modeled',
            sunHours: Number(sunHours.toFixed(2)),
            widthFt: cellSizeFt,
            xFt,
            yFt,
          },
          sources,
          microclimateNotes,
        ),
      );
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
    sampleMinutes,
    season: options.season,
    timeWindow: 'allDay',
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

  if (required === 'partShade' && actual === 'fullSun') {
    return false;
  }

  if (required === 'fullShade' && actual !== 'fullShade') {
    return false;
  }

  return getSunExposureScore(actual) >= getSunExposureScore(required);
}

export function createManualSunArea(
  season: SunSeason,
  xFt: number,
  yFt: number,
  exposure: SunExposure,
  metadata: {
    microclimateNotes?: SunShadeMicroclimateNote[] | undefined;
    shadeSources?: SunShadeSource[] | undefined;
  } = {},
): SunShadeArea {
  return withAreaMetadata(
    {
      depthFt: cellSizeFt,
      exposure,
      id: `${season}-${Math.floor(xFt)}-${Math.floor(yFt)}`,
      source: 'manual',
      sunHours: manualSunHours(exposure),
      widthFt: cellSizeFt,
      xFt: Math.floor(xFt),
      yFt: Math.floor(yFt),
    },
    metadata.shadeSources ?? [],
    metadata.microclimateNotes ?? [],
  );
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
      observedOn: previousLayer?.observedOn ?? layer.observedOn,
      areas: layer.areas.map((area) => {
        const manualArea = manualAreas.find(
          (candidate) =>
            candidate.xFt === area.xFt && candidate.yFt === area.yFt,
        );

        return manualArea ? mergeManualArea(area, manualArea) : area;
      }),
    };
  });
}

function mergeManualArea(modeledArea: SunShadeArea, manualArea: SunShadeArea) {
  return withAreaMetadata(
    {
      ...modeledArea,
      ...manualArea,
    },
    modeledArea.shadeSources ?? manualArea.shadeSources ?? [],
    manualArea.microclimateNotes ?? modeledArea.microclimateNotes ?? [],
  );
}

export function getSunExposureScore(exposure: SunExposure) {
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

function withAreaMetadata(
  area: SunShadeArea,
  shadeSources: SunShadeSource[],
  microclimateNotes: SunShadeMicroclimateNote[],
): SunShadeArea {
  const baseArea = { ...area };

  delete baseArea.microclimateNotes;
  delete baseArea.shadeSources;

  return {
    ...baseArea,
    ...(microclimateNotes.length > 0 ? { microclimateNotes } : {}),
    ...(shadeSources.length > 0 ? { shadeSources } : {}),
  };
}
