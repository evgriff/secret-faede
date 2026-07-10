import {
  GardenTimeError,
  addGardenDays,
  differenceInGardenDays,
  gardenDateTimeToIso,
  getGardenDate,
  nextGardenTimeIso,
} from './gardenTime';

describe('gardenTime', () => {
  it('uses the required garden timezone without a Detroit fallback', () => {
    expect(
      getGardenDate('2026-07-10T02:30:00.000Z', 'America/Los_Angeles'),
    ).toBe('2026-07-09');
    expect(getGardenDate('2026-07-10T02:30:00.000Z', 'Asia/Tokyo')).toBe(
      '2026-07-10',
    );
    expect(() => getGardenDate('2026-07-10T02:30:00.000Z', '')).toThrow(
      GardenTimeError,
    );
    expect(() =>
      getGardenDate('2026-07-10T02:30:00.000Z', 'Not/A_Timezone'),
    ).toThrow('Invalid IANA timezone');
  });

  it('adds calendar days across month and year rollover', () => {
    expect(addGardenDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addGardenDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('treats equal wall-clock times across DST as one garden day', () => {
    expect(
      differenceInGardenDays(
        '2026-03-07T13:00:00.000Z',
        '2026-03-08T12:00:00.000Z',
        'America/New_York',
      ),
    ).toBe(1);
    expect(
      differenceInGardenDays(
        '2026-10-31T12:00:00.000Z',
        '2026-11-01T13:00:00.000Z',
        'America/New_York',
      ),
    ).toBe(1);
  });

  it('makes missing and repeated DST times explicit', () => {
    expect(() =>
      gardenDateTimeToIso('2026-03-08', '02:30', 'America/New_York', {
        ambiguous: 'reject',
        missing: 'reject',
      }),
    ).toThrow('does not exist');
    expect(
      gardenDateTimeToIso('2026-03-08', '02:30', 'America/New_York', {
        ambiguous: 'later',
        missing: 'nextValid',
      }),
    ).toBe('2026-03-08T07:00:00.000Z');

    const earlier = gardenDateTimeToIso(
      '2026-11-01',
      '01:30',
      'America/New_York',
      { ambiguous: 'earlier', missing: 'reject' },
    );
    const later = gardenDateTimeToIso(
      '2026-11-01',
      '01:30',
      'America/New_York',
      { ambiguous: 'later', missing: 'reject' },
    );

    expect(earlier).toBe('2026-11-01T05:30:00.000Z');
    expect(later).toBe('2026-11-01T06:30:00.000Z');
  });

  it('rolls a passed daily check into the next garden date', () => {
    expect(
      nextGardenTimeIso(
        '2026-07-10T03:30:00.000Z',
        '07:00',
        'America/Los_Angeles',
      ),
    ).toBe('2026-07-10T14:00:00.000Z');
  });
});
