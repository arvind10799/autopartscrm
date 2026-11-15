import { suggestionLocalTime } from './reminder-suggestions';
describe('suggested follow-up timing', () => {
  const start = new Date('2026-03-07T15:00Z');
  it('uses calendar days across daylight saving instead of elapsed 24-hour blocks', () => {
    expect(
      suggestionLocalTime(
        { delayDays: 1, delayMinutes: 0, requiresTime: false },
        'America/New_York',
        start,
        start,
      ),
    ).toBe('2026-03-08T10:00');
  });
  it('uses elapsed minutes when the day delay is zero', () => {
    expect(
      suggestionLocalTime(
        { delayDays: 0, delayMinutes: 60, requiresTime: false },
        'America/New_York',
        start,
        start,
      ),
    ).toBe('2026-03-07T11:00');
  });
  it('leaves a callback time unset until the user chooses it', () => {
    expect(
      suggestionLocalTime(
        { delayDays: 0, delayMinutes: 60, requiresTime: true },
        'America/New_York',
        start,
        start,
      ),
    ).toBeNull();
  });
  it('offers a future time when an old suggestion is accepted late', () => {
    expect(
      suggestionLocalTime(
        { delayDays: 1, delayMinutes: 0, requiresTime: false },
        'America/New_York',
        start,
        new Date('2026-03-10T16:00Z'),
      ),
    ).toBe('2026-03-10T13:00');
    expect(
      suggestionLocalTime(
        { delayDays: 0, delayMinutes: 60, requiresTime: false },
        'America/New_York',
        start,
        new Date('2026-03-10T16:00Z'),
      ),
    ).toBe('2026-03-10T12:01');
  });
});
