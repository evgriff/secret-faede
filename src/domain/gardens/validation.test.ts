import {
  detroitClimateProfile,
  createDefaultGarden,
  createDefaultPlanting,
  CURRENT_GARDEN_SCHEMA_VERSION,
  isGarden,
  migrateGardenRecord,
  parseGarden,
  parseHarvestEvent,
  parseJournalEntry,
  parseNotificationLog,
  parseNotificationPreference,
  parsePlot,
  parseTask,
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
      snapUnitFt: 0.125,
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
    expect(garden.schemaVersion).toBe(CURRENT_GARDEN_SCHEMA_VERSION);
    expect(garden.plantings[0]).toMatchObject({
      id: 'plant-1',
      mode: 'single',
      xFt: 3,
      yFt: 4,
    });
  });

  it('normalizes legacy garden records through the schema migration layer', () => {
    const migration = migrateGardenRecord({
      name: 'Legacy garden',
      plants: [{ id: 'plant-1', xFt: 3, yFt: 4 }],
      plot: { depthFt: 8, widthFt: 12 },
    });

    expect(migration).toMatchObject({
      applied: [
        'legacy plants copied into plantings',
        'planner workspace defaults normalized',
        'season plan inputs simplified',
        'plant planning defaults normalized',
        'planting events normalized',
        'planting support structure links normalized',
      ],
      fromVersion: 0,
      toVersion: CURRENT_GARDEN_SCHEMA_VERSION,
    });
    expect(migration.record).toMatchObject({
      plantings: [{ id: 'plant-1', supportStructureIds: [], xFt: 3, yFt: 4 }],
      plot: {
        gridUnitFt: 1,
        snapUnitFt: 0.125,
      },
      schemaVersion: CURRENT_GARDEN_SCHEMA_VERSION,
      seasonPlan: {
        updatedAtIso: null,
        wantedCrops: [],
      },
      structures: [],
    });
  });

  it('migrates season plans away from hidden weighting fields', () => {
    const migration = migrateGardenRecord({
      schemaVersion: 2,
      seasonPlan: {
        updatedAtIso: '2026-04-21T12:00:00.000Z',
        wantedCrops: [
          {
            commitment: 'mustGrow',
            containerAllowed: false,
            cropId: 'tomato',
            id: 'season-tomato',
            modePreference: 'row',
            notes: 'Sauce crop',
            priority: 'high',
            rank: 0,
            sowPreference: 'transplant',
            supportAllowed: true,
            targetQuantity: 3,
            varietyName: 'Roma',
          },
        ],
      },
    });

    expect(migration).toMatchObject({
      applied: [
        'season plan inputs simplified',
        'plant planning defaults normalized',
        'watering schedule normalized',
      ],
      fromVersion: 2,
      toVersion: CURRENT_GARDEN_SCHEMA_VERSION,
    });
    expect(migration.record.seasonPlan).toMatchObject({
      wantedCrops: [
        {
          cropId: 'tomato',
          id: 'season-tomato',
          notes: 'Sauce crop',
          plantingForm: 'row',
          quantity: 3,
          supportAllowed: true,
          varietyName: 'Roma',
        },
      ],
    });
    expect(
      (migration.record.seasonPlan as { wantedCrops: Array<object> })
        .wantedCrops[0],
    ).not.toHaveProperty('priority');
  });

  it('adds explicit plant support defaults and drops legacy node overlays', () => {
    const migration = migrateGardenRecord({
      markerLayer: [{ id: 'marker-1' }],
      plantNodes: [{ id: 'node-1' }],
      plantings: [
        {
          id: 'tomato-row',
          label: 'Tomato',
          plantCount: 3,
          supportType: 'cage',
          xFt: 3,
          yFt: 4,
        },
      ],
      schemaVersion: 3,
    });

    expect(migration).toMatchObject({
      applied: [
        'plant planning defaults normalized',
        'watering schedule normalized',
        'planting events normalized',
        'planting support structure links normalized',
      ],
      fromVersion: 3,
      toVersion: CURRENT_GARDEN_SCHEMA_VERSION,
    });
    expect(migration.record.plantings).toMatchObject([
      {
        id: 'tomato-row',
        support: {
          perPlant: true,
          quantity: 3,
          type: 'cage',
        },
        supportStructureIds: [],
      },
    ]);
    expect(migration.record).not.toHaveProperty('markerLayer');
    expect(migration.record).not.toHaveProperty('plantNodes');
  });

  it('removes legacy utility structures while keeping page-level planning structures', () => {
    const migration = migrateGardenRecord({
      schemaVersion: 4,
      structures: [
        { id: 'bed-1', type: 'raisedBed' },
        { id: 'path-1', type: 'pathway' },
        { id: 'trellis-1', type: 'trellis' },
        { id: 'tree-1', type: 'treeObstacle' },
        { id: 'compost-1', type: 'compost' },
        { id: 'hose-1', type: 'waterSource' },
      ],
    });

    expect(migration.applied).toEqual([
      'legacy utility structures removed',
      'watering schedule normalized',
    ]);
    expect(migration.record.structures).toEqual([
      { id: 'bed-1', type: 'raisedBed' },
      { id: 'path-1', type: 'pathway' },
      { id: 'trellis-1', type: 'trellis' },
    ]);
  });

  it('migrates legacy water recommendations into the canonical watering schedule', () => {
    const garden = parseGarden('user-a', {
      schemaVersion: 5,
      waterRecommendations: [
        {
          deficitInches: 0.5,
          generatedAtIso: '2026-06-21T11:00:00.000Z',
          gardenId: 'user-a',
          id: 'water-1',
          inchesNeeded: 0.5,
          plantingId: 'tomato-1',
          rationale: ['Dry soil.'],
          reason: 'Dry soil',
          recommendationDate: '2026-06-21',
          recommendedWaterInches: 0.5,
          status: 'active',
          suppressUntilIso: null,
          targetId: 'tomato-1',
          targetLabel: 'Tomato',
          targetType: 'planting',
          urgency: 'medium',
          waterBalance: {
            baselineDate: '2026-06-18',
            baselineSource: 'plantingEvent',
            currentDepletionInches: 0.5,
            dailyNeedInches: 0.18,
            effectiveDeficitInches: 0.5,
            forecastCreditInches: 0,
            manualWaterCreditInches: 0,
            modelVersion: 'water-balance-v1',
            nextCheckReason: 'Dry weather has built a water deficit.',
            plantingWaterCreditInches: 0,
            recentRainCreditInches: 0,
            rootZoneCapacityInches: 1.1,
            rootZoneCapacitySource: 'estimated',
            thresholdInches: 0.18,
          },
          weatherSnapshotId: 'weather-1',
        },
      ],
    });

    expect(garden.wateringSchedule).toEqual([
      expect.objectContaining({
        dueDate: '2026-06-21',
        id: 'water-1',
        reasonDetails: ['Dry soil.'],
        reasonSummary: 'Dry soil',
        status: 'due',
        targetAmountInches: 0.5,
        targetId: 'tomato-1',
        targetKind: 'planting',
        waterBalance: expect.objectContaining({
          baselineDate: '2026-06-18',
          modelVersion: 'water-balance-v1',
        }),
      }),
    ]);
  });

  it('rejects impossible saved weather rain totals before they suppress watering', () => {
    const garden = parseGarden('user-a', {
      schemaVersion: CURRENT_GARDEN_SCHEMA_VERSION,
      weatherSnapshots: [
        {
          capturedAtIso: '2026-04-24T23:30:00.000Z',
          conditionSummary: 'Light Rain',
          dataQuality: 'complete',
          forecastDays: [
            {
              conditionSummary: 'Rain',
              date: '2026-04-25',
              expectedRainIn: 16,
              highF: 64,
            },
          ],
          forecastRainNext24In: 16,
          forecastRainNext48In: 20,
          frostRisk: 'none',
          gardenId: 'user-a',
          heatRisk: 'none',
          humidityPercent: 90,
          id: 'weather-bad-rain',
          nextRainIso: null,
          observedForDate: '2026-04-24',
          overnightLowF: 52,
          precipitationIn: 500,
          providerLabel: 'National Weather Service',
          recentPrecipitation72hIn: 500,
          source: 'nationalWeatherService',
          temperatureF: 64,
          windMph: 5,
        },
      ],
    });

    expect(garden.weatherSnapshots[0]).toMatchObject({
      dataQuality: 'limited',
      forecastRainNext24In: null,
      forecastRainNext48In: null,
      precipitationIn: null,
      recentPrecipitation72hIn: null,
    });
    expect(garden.weatherSnapshots[0]?.forecastDays?.[0]).toMatchObject({
      expectedRainIn: 0,
    });
  });

  it('backfills legacy thinning timestamps into planting events', () => {
    const garden = parseGarden('user-a', {
      schemaVersion: 6,
      plantings: [
        {
          id: 'carrot-row',
          label: 'Carrot row',
          plantStatus: {
            thinned: true,
            thinnedAtIso: '2026-06-20T12:00:00.000Z',
          },
          xFt: 2,
          yFt: 2,
        },
      ],
    });

    expect(garden.plantings[0]).toMatchObject({
      plantingEvents: [
        {
          occurredOn: '2026-06-20',
          type: 'thinned',
        },
      ],
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
        {
          depthFt: 1,
          id: 'legacy-water-1',
          label: 'Water source',
          type: 'waterSource',
          widthFt: 1,
          xFt: 2,
          yFt: 2,
        },
      ],
    });

    expect(garden.structures).toHaveLength(1);
    expect(garden.structures[0]).toMatchObject({
      accessiblePath: true,
      continuousPath: true,
      material: 'woodChips',
      type: 'pathway',
      workingClearanceFt: null,
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

  it('parses per-plant support plans with quantity-safe defaults', () => {
    const garden = parseGarden('user-a', {
      plantings: [
        {
          id: 'tomato-row',
          label: 'Tomato',
          mode: 'row',
          plantCount: 3,
          supportType: 'stake',
          xFt: 4,
          yFt: 4,
        },
      ],
    });

    expect(garden.plantings[0]).toMatchObject({
      support: {
        perPlant: true,
        quantity: 3,
        type: 'stake',
      },
    });
  });

  it('parses sun/shade source metadata and microclimate notes', () => {
    const garden = parseGarden('user-a', {
      sunShadeLayers: [
        {
          areas: [
            {
              depthFt: 1,
              exposure: 'partShade',
              id: 'summer-1-1',
              microclimateNotes: [
                {
                  description: 'Cooler near the tree.',
                  id: 'microclimate:coolShadePocket',
                  kind: 'coolShadePocket',
                  label: 'Cool shade pocket',
                  source: 'modeled',
                },
              ],
              shadeSources: [
                {
                  heightFt: 7,
                  itemId: 'pea-line',
                  itemType: 'planting',
                  kind: 'trellisedCrop',
                  label: 'Pea line',
                },
              ],
              source: 'modeled',
              sunHours: 3,
              widthFt: 1,
              xFt: 1,
              yFt: 1,
            },
          ],
          id: 'sun-summer',
          season: 'summer',
        },
      ],
    });

    expect(garden.sunShadeLayers[0]?.areas[0]).toMatchObject({
      microclimateNotes: [
        {
          kind: 'coolShadePocket',
          label: 'Cool shade pocket',
        },
      ],
      shadeSources: [
        {
          itemId: 'pea-line',
          kind: 'trellisedCrop',
        },
      ],
    });
  });

  it('parses seasonal wanted crops for pre-layout planning', () => {
    const garden = parseGarden('user-a', {
      seasonPlan: {
        updatedAtIso: '2026-04-21T12:00:00.000Z',
        wantedCrops: [
          {
            commitment: 'mustGrow',
            containerAllowed: false,
            cropId: 'tomato',
            id: 'season-tomato',
            modePreference: 'row',
            notes: 'Cherry type',
            priority: 'high',
            rank: 2,
            sowPreference: 'transplant',
            supportAllowed: true,
            targetQuantity: 0,
            varietyName: 'Sungold',
          },
        ],
      },
    });

    expect(garden.seasonPlan).toMatchObject({
      updatedAtIso: '2026-04-21T12:00:00.000Z',
      wantedCrops: [
        {
          cropId: 'tomato',
          plantingForm: 'row',
          quantity: 1,
          supportAllowed: true,
          varietyName: 'Sungold',
        },
      ],
    });
    expect(garden.seasonPlan.wantedCrops[0]).not.toHaveProperty('commitment');
    expect(garden.seasonPlan.wantedCrops[0]).not.toHaveProperty('priority');
    expect(garden.seasonPlan.wantedCrops[0]).not.toHaveProperty('rank');
    expect(garden.seasonPlan.wantedCrops[0]).not.toHaveProperty(
      'sowPreference',
    );
    expect(garden.seasonPlan.wantedCrops[0]).not.toHaveProperty(
      'containerAllowed',
    );
  });

  it('provides Detroit climate and notification defaults', () => {
    const plot = parsePlot({});
    const preferences = parseNotificationPreference({});

    expect(plot.location).toMatchObject({
      locationQuery: 'Detroit, MI',
      timezone: 'America/Detroit',
    });
    expect(detroitClimateProfile).toMatchObject({
      averageFirstFrost: '10-15',
      averageLastFrost: '04-30',
      hardinessZone: '6b',
    });
    expect(preferences).toMatchObject({
      defaultWateringCheckTime: '07:00',
      timezone: 'America/Detroit',
      wateringAlertThresholdIn: 0.25,
    });
  });

  it('ignores unsupported legacy notification preference fields', () => {
    const preferences = parseNotificationPreference({
      channelConsent: {
        email: {
          consentCopyVersion: 'legacy',
          grantedAtIso: '2026-04-20T11:00:00.000Z',
          revokedAtIso: null,
          status: 'granted',
        },
        retiredDelivery: {
          consentCopyVersion: 'legacy',
          grantedAtIso: '2026-04-20T11:00:00.000Z',
          revokedAtIso: null,
          status: 'granted',
        },
      },
      channels: {
        email: true,
        inApp: false,
        push: true,
        retiredDelivery: true,
      },
      email: 'alerts@example.com',
      phoneE164: '+17345550123',
    });

    expect(preferences.channels).toMatchObject({ inApp: true, push: true });
    expect(preferences.channels).not.toHaveProperty('email');
    expect(preferences.channels).not.toHaveProperty('retiredDelivery');
    expect(preferences.channelConsent).not.toHaveProperty('email');
    expect(preferences.channelConsent).not.toHaveProperty('retiredDelivery');
    expect(preferences).not.toHaveProperty('email');
    expect(preferences).not.toHaveProperty('phoneE164');
  });

  it('parses harvest delay metadata on tasks', () => {
    expect(
      parseTask({
        delayReason: 'Not ready in the field.',
        delaySetAtIso: '2026-06-21T12:00:00.000Z',
        id: 'task-1',
        title: 'Check radishes for harvest',
        type: 'harvest',
      }),
    ).toMatchObject({
      delayReason: 'Not ready in the field.',
      delaySetAtIso: '2026-06-21T12:00:00.000Z',
      type: 'harvest',
    });
  });

  it('parses notification acknowledgement and snooze state', () => {
    expect(
      parseNotificationLog({
        acknowledgedAtIso: null,
        body: 'Water tomatoes today.',
        channel: 'inApp',
        createdAtIso: '2026-06-21T11:00:00.000Z',
        dismissedAtIso: null,
        dryRun: false,
        gardenId: 'user-a',
        id: 'log-1',
        messageSummary: 'Water tomatoes',
        recipientRedacted: 'in-app',
        sentAtIso: '2026-06-21T11:00:00.000Z',
        snoozedUntilIso: '2026-06-22T11:00:00.000Z',
        status: 'sent',
        taskId: 'water-1',
        type: 'watering',
        userId: 'user-a',
      }),
    ).toMatchObject({
      snoozedUntilIso: '2026-06-22T11:00:00.000Z',
      type: 'watering',
    });
  });

  it('drops retired delivery notification logs instead of surfacing them', () => {
    expect(
      parseNotificationLog({
        body: 'Legacy email alert.',
        channel: 'email',
        createdAtIso: '2026-06-21T11:00:00.000Z',
        dryRun: true,
        id: 'email-log',
        messageSummary: 'Legacy email alert',
        provider: null,
        recipientRedacted: 'e***@example.com',
        sentAtIso: null,
        status: 'skipped',
        taskId: null,
        type: 'weather',
        userId: 'user-a',
      }),
    ).toBeNull();

    expect(
      parseNotificationLog({
        body: 'Legacy delivery alert.',
        channel: 'retiredDelivery',
        createdAtIso: '2026-06-21T11:00:00.000Z',
        dryRun: true,
        id: 'retired-delivery-log',
        messageSummary: 'Legacy delivery alert',
        provider: 'retiredDeliveryProvider',
        recipientRedacted: '***0123',
        sentAtIso: null,
        status: 'skipped',
        taskId: null,
        type: 'weather',
        userId: 'user-a',
      }),
    ).toBeNull();
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
      issueStatus: 'open',
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
