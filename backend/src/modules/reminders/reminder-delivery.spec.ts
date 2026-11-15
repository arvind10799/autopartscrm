import { alertStage } from './reminder-delivery.service';
import {
  withinShift,
  nextShift,
  shiftInstant,
  shiftDay,
  defaultShift,
} from './reminder-delivery-time';
import { validatePushEndpoint } from './reminder-notification.service';
describe('reminder delivery boundaries', () => {
  const dueAt = new Date('2026-11-14T18:00Z');
  it('suppresses early alerts until an explicit snooze expires', () => {
    expect(
      alertStage(
        {
          dueAt,
          earlyAlertMinutes: 30,
          status: 'SNOOZED',
          snoozedUntil: dueAt,
        },
        new Date('2026-11-14T17:45Z'),
        30,
      ),
    ).toBeNull();
    expect(
      alertStage(
        {
          dueAt,
          earlyAlertMinutes: 30,
          status: 'SNOOZED',
          snoozedUntil: dueAt,
        },
        dueAt,
        30,
      ),
    ).toBe('DUE');
  });
  it('coalesces missed early/due alerts into the current stage', () => {
    const row = { dueAt, earlyAlertMinutes: 15 };
    expect(alertStage(row, new Date('2026-11-14T17:44Z'), 30)).toBeNull();
    expect(alertStage(row, new Date('2026-11-14T17:45Z'), 30)).toBe('EARLY');
    expect(alertStage(row, new Date('2026-11-14T18:00Z'), 30)).toBe('DUE');
    expect(alertStage(row, new Date('2026-11-14T18:30Z'), 30)).toBe(
      'SECOND_ALERT',
    );
    expect(alertStage(row, new Date('2026-11-15T18:00Z'), null)).toBe('DUE');
  });
  it('defers ordinary alerts to the next local shift and includes start but excludes end', () => {
    expect(withinShift(new Date('2026-11-14T17:00Z'), defaultShift)).toBe(true);
    expect(withinShift(new Date('2026-11-15T01:00Z'), defaultShift)).toBe(
      false,
    );
    expect(
      nextShift(new Date('2026-11-15T02:00Z'), defaultShift).toISOString(),
    ).toBe('2026-11-15T17:00:00.000Z');
  });
  it('keeps an overnight digest attached to the preceding shift date', () => {
    const p = {
      ...defaultShift,
      workingStartMinute: 1200,
      workingEndMinute: 360,
    };
    expect(withinShift(new Date('2026-11-15T09:00Z'), p)).toBe(true);
    expect(shiftDay(new Date('2026-11-15T09:00Z'), p)).toBe('2026-11-14');
  });
  it('moves a nonexistent spring shift start to the first available minute', () => {
    expect(
      shiftInstant('2026-03-08', 150, 'America/New_York').toISOString(),
    ).toBe('2026-03-08T07:00:00.000Z');
  });
  it('chooses one earliest start in the repeated autumn hour', () => {
    expect(
      shiftInstant('2026-11-01', 90, 'America/New_York').toISOString(),
    ).toBe('2026-11-01T05:30:00.000Z');
  });
  it.each([
    'http://fcm.googleapis.com/x',
    'https://127.0.0.1/x',
    'https://fcm.googleapis.com.evil.test/x',
    'https://evil.test/x',
    'https://fcm.googleapis.com:444/x',
    'https://user:pass@fcm.googleapis.com/x',
  ])('rejects arbitrary/private push destinations %s', (endpoint) =>
    expect(() => validatePushEndpoint(endpoint)).toThrow(),
  );
  it.each([
    'https://fcm.googleapis.com/wp/x',
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://web.push.apple.com/x',
    'https://wns.notify.windows.com/x',
  ])('accepts official HTTPS push destinations %s', (endpoint) =>
    expect(validatePushEndpoint(endpoint)).toBe(endpoint),
  );
});
