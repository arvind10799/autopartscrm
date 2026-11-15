import { nextRepeatTime, validateRepeat } from './reminder-repeat';

const daily = {
  frequency: 'DAILY' as const,
  intervalDays: 1,
  weekday: null,
  lastScheduledLocalAt: '2030-06-10T10:00',
  timeZone: 'America/New_York',
  untilDate: null,
};
describe('repeating reminders use civil dates and one future occurrence', () => {
  it.each([
    ['2030-06-10T14:00Z', '2030-06-11T10:00'],
    ['2030-06-15T13:59Z', '2030-06-15T10:00'],
    ['2030-06-15T14:00Z', '2030-06-16T10:00'],
    ['2040-06-15T14:00Z', '2040-06-16T10:00'],
  ])('skips missed slots after %s', (now, expected) => {
    expect(nextRepeatTime(daily, new Date(now))?.localDueAt).toBe(expected);
  });
  it('keeps the N day anchor instead of scheduling N days after completion', () => {
    expect(
      nextRepeatTime(
        { ...daily, frequency: 'EVERY_N_DAYS', intervalDays: 3 },
        new Date('2030-06-15T15:00Z'),
      )?.localDueAt,
    ).toBe('2030-06-16T10:00');
  });
  it('uses the selected weekday, including a different first due weekday', () => {
    expect(
      nextRepeatTime(
        { ...daily, frequency: 'WEEKLY', intervalDays: 7, weekday: 5 },
        new Date('2030-06-10T15:00Z'),
      )?.localDueAt,
    ).toBe('2030-06-14T10:00');
  });
  it('includes the end date but never generates an occurrence beyond it', () => {
    const s = { ...daily, untilDate: '2030-06-11' };
    expect(nextRepeatTime(s, new Date('2030-06-10T15:00Z'))?.localDueAt).toBe(
      '2030-06-11T10:00',
    );
    expect(nextRepeatTime(s, new Date('2030-06-11T15:00Z'))).toBeNull();
  });
  it('shifts a nonexistent spring clock to the first valid minute without changing the nominal clock', () => {
    const next = nextRepeatTime(
      { ...daily, lastScheduledLocalAt: '2026-03-07T02:30' },
      new Date('2026-03-07T12:00Z'),
    )!;
    expect(next.localDueAt).toBe('2026-03-08T03:00');
    expect(next.nominalLocalAt).toBe('2026-03-08T02:30');
    expect(next.dueAt.toISOString()).toBe('2026-03-08T07:00:00.000Z');
    expect(
      nextRepeatTime(
        { ...daily, lastScheduledLocalAt: next.nominalLocalAt },
        next.dueAt,
      )?.localDueAt,
    ).toBe('2026-03-09T02:30');
  });
  it('chooses the first fall-back instant and does not repeat that date twice', () => {
    const s = { ...daily, lastScheduledLocalAt: '2026-10-31T01:30' };
    expect(
      nextRepeatTime(s, new Date('2026-10-31T12:00Z'))?.dueAt.toISOString(),
    ).toBe('2026-11-01T05:30:00.000Z');
    expect(nextRepeatTime(s, new Date('2026-11-01T05:31Z'))?.localDueAt).toBe(
      '2026-11-02T01:30',
    );
  });
  it('does not introduce daylight saving in Arizona', () => {
    expect(
      nextRepeatTime(
        {
          ...daily,
          timeZone: 'America/Phoenix',
          lastScheduledLocalAt: '2026-03-07T10:00',
        },
        new Date('2026-03-07T18:00Z'),
      )?.dueAt.toISOString(),
    ).toBe('2026-03-08T17:00:00.000Z');
  });
  it.each([
    { frequency: 'NONE', maxOccurrences: 3 },
    { frequency: 'DAILY', intervalDays: 2 },
    { frequency: 'DAILY', weekday: 1 },
    { frequency: 'EVERY_N_DAYS' },
    { frequency: 'DAILY', untilDate: '2030-02-30' },
    { frequency: 'DAILY', untilDate: '2029-01-01' },
    { frequency: 'DAILY', stopStatus: 'DELIVERED' },
    { frequency: 'DAILY', untilDate: null },
  ])('rejects an incompatible repeat configuration %#', (input) => {
    expect(() =>
      validateRepeat(input as never, 'PERSONAL', daily.lastScheduledLocalAt),
    ).toThrow();
  });
  it('defaults a weekly schedule to the first due weekday and accepts no repetition', () => {
    expect(
      validateRepeat(
        { frequency: 'WEEKLY' },
        'PERSONAL',
        daily.lastScheduledLocalAt,
      )?.weekday,
    ).toBe(1);
    expect(
      validateRepeat(
        { frequency: 'NONE' },
        'PERSONAL',
        daily.lastScheduledLocalAt,
      ),
    ).toBeNull();
    expect(
      validateRepeat(undefined, 'PERSONAL', daily.lastScheduledLocalAt),
    ).toBeNull();
  });
});
