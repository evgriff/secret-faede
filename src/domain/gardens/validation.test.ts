import {
  annArborClimateProfile,
  createDefaultGarden,
  createDefaultPlanting,
  isGarden,
  parseGarden,
  parseHarvestEvent,
  parseJournalEntry,
  parseNotificationPreference,
  parsePlot,
} from './GardenRepository';

describe('garden domain validation', () => {
  it('keeps plot dimensions and planting coordinates in bounded feet', () => {
    const garden = parseGarden('user-a', {
      plantings: [
        {
          id: 'planting-1',
          label: 'Tomato',
          mode: 'single',
          xFt: 200,
          yFt: -2,
        },
      ],
      plot: {
        depthFt: 200,
        widthFt: 0,
      },
    });

    expect(garden.plot).toMatchObject({
      depthFt: 100,
      gridUnitFt: 1,
      snapUnitFt: 0.5,
      widthFt: 1,
    });
    expect(garden.plantings[0]).toMatchObject({
      xFt: 1,
      yFt: 0,
    });
  });

  it('migrates legacy plants into canonical plantings', () => {
    const garden = parseGarden('user-a', {
      plants: [
        {
          id: 'plant-1',
          xFt: 3,
          yFt: 4,
        },
      ],
    });

    expect(garden.plantings).toHaveLength(1);
    expect(garden.plantings[0]).toMatchObject({
      id: 'plant-1',
      mode: 'single',
      xFt: 3,
      yFt: 4,
    });
  });

  it('parses structure planner types and keeps footprints inside the plot', () => {
    const garden = parseGarden('user-a', {
      plot: {
        depthFt: 8,
        widthFt: 12,
      },
      structures: [
        {
          depthFt: 4,
          id: 'path-1',
          label: 'Path',
          type: 'pathway',
          widthFt: 6,
          xFt: 20,
          yFt: 20,
        },
      ],
    });

    expect(garden.structures[0]).toMatchObject({
      type: 'pathway',
      xFt: 6,
      yFt: 4,
    });
  });

  it('parses mature planting snapshots for spacing overlays', () => {
    const garden = parseGarden('user-a', {
      plantings: [
        {
          id: 'planting-1',
          label: 'Tomato',
          matureHeightInches: 72,
          matureSpreadInches: 36,
          xFt: 4,
          yFt: 4,
        },
      ],
    });

    expect(garden.plantings[0]).toMatchObject({
      matureHeightInches: 72,
      matureSpreadInches: 36,
    });
  });

  it('provides Detroit climate and notification defaults', () => {
    const plot = parsePlot({});
    const preferences = parseNotificationPreference({});

    expect(plot.location).toMatchObject({
      locationQuery: 'Detroit, MI',
      timezone: 'America/Detroit',
    });
    expect(annArborClimateProfile).toMatchObject({
      averageFirstFrost: '10-05',
      averageLastFrost: '05-10',
      hardinessZone: '6a',
    });
    expect(preferences).toMatchObject({
      defaultWateringCheckTime: '07:00',
      timezone: 'America/Detroit',
      wateringAlertThresholdIn: 0.25,
    });
  });

  it('parses issue journals with photo metadata and freeform harvests', () => {
    expect(
      parseJournalEntry({
        body: 'Chewed leaves on basil.',
        id: 'journal-1',
        issueCategory: 'pest',
        issueSeverity: 'high',
        issueStatus: 'todo',
        photos: [
          {
            contentType: 'image/jpeg',
            downloadUrl: 'https://example.com/basil.jpg',
            fileName: 'basil.jpg',
            id: 'photo-1',
            sizeBytes: 123,
            storagePath: 'users/user-a/journal/journal-1/photo-1-basil.jpg',
            uploadedAtIso: '2026-07-01T12:00:00.000Z',
          },
        ],
        targetType: 'planting',
        type: 'issue',
      }),
    ).toMatchObject({
      issueCategory: 'pest',
      issueSeverity: 'high',
      issueStatus: 'todo',
      photos: [
        {
          fileName: 'basil.jpg',
        },
      ],
      targetType: 'planting',
      type: 'issue',
    });

    expect(
      parseHarvestEvent({
        amountText: 'A full basket',
        id: 'harvest-1',
        unit: 'freeform',
      }),
    ).toMatchObject({
      amountText: 'A full basket',
      quantity: null,
      unit: 'freeform',
    });
  });

  it('recognizes the durable garden aggregate shape', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        createDefaultPlanting({
          id: 'planting-1',
          label: 'Basil',
          xFt: 2,
          yFt: 2,
        }),
      ],
    };

    expect(isGarden(garden)).toBe(true);
  });
});
