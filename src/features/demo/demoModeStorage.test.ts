import {
  createDefaultGarden,
  createDefaultUserProfile,
} from '../../domain/gardens/GardenRepository';
import { createSampleGarden } from '../../domain/gardens/sampleGarden';
import {
  clearDemoModeBackup,
  clearDemoModeSession,
  hasDemoModeSession,
  isSampleGarden,
  readDemoModeBackup,
  writeDemoModeBackup,
  writeDemoModeSession,
} from './demoModeStorage';

describe('demo mode storage', () => {
  it('identifies only the seeded sample garden garden as demo state', () => {
    expect(isSampleGarden(createDefaultGarden('user-a'))).toBe(false);
    expect(isSampleGarden(createSampleGarden('user-a'))).toBe(true);
  });

  it('stores and clears the real garden backup and demo session marker', () => {
    const garden = createDefaultGarden('user-a');
    const profile = createDefaultUserProfile('user-a', 'user@example.com');

    writeDemoModeBackup('user-a', {
      garden,
      profile,
      savedAtIso: '2026-06-21T14:00:00.000Z',
      sourceGardenName: garden.name,
    });
    writeDemoModeSession('user-a');

    expect(readDemoModeBackup('user-a')?.sourceGardenName).toBe('Home garden');
    expect(hasDemoModeSession('user-a')).toBe(true);

    clearDemoModeBackup('user-a');
    clearDemoModeSession('user-a');

    expect(readDemoModeBackup('user-a')).toBeNull();
    expect(hasDemoModeSession('user-a')).toBe(false);
  });
});
