import {
  resetTodayWeatherAutoRefreshForTests,
  shouldRunTodayWeatherAutoRefresh,
} from './todayWeatherRefreshPolicy';

describe('todayWeatherRefreshPolicy', () => {
  beforeEach(() => {
    resetTodayWeatherAutoRefreshForTests();
  });

  it('throttles route remounts but allows a later load to self-heal', () => {
    const key = 'user-a:garden-a:2026-06-21';

    expect(shouldRunTodayWeatherAutoRefresh(key, 1_000)).toBe(true);
    expect(shouldRunTodayWeatherAutoRefresh(key, 2_000)).toBe(false);
    expect(shouldRunTodayWeatherAutoRefresh(key, 302_000)).toBe(true);
  });
});
