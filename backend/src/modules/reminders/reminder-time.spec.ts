import {
  customerTimeZone,
  normalizeUsState,
  resolveReminderTime,
} from './reminder-time';

const now = new Date('2026-01-01T00:00:00Z');
describe('customer-local reminder scheduling', () => {
  it.each([
    ['New York', 'America/New_York'],
    [' tx ', 'America/Chicago'],
    ['Colorado', 'America/Denver'],
    ['AZ', 'America/Phoenix'],
    ['CA', 'America/Los_Angeles'],
    ['AK', 'America/Los_Angeles'],
    ['HI', 'America/Los_Angeles'],
    ['Ontario', 'America/Los_Angeles'],
    [null, 'America/Los_Angeles'],
  ])('maps %s to %s', (state, zone) =>
    expect(customerTimeZone(state)).toBe(zone),
  );

  it('normalizes state names and abbreviations without parsing addresses', () => {
    expect(normalizeUsState('new york')).toBe('NY');
    expect(normalizeUsState('123 Main St, New York')).toBeNull();
  });
  it('preserves the customer clock when rebasing to a new state zone', () => {
    const local = '2026-07-01T16:00';
    expect(
      resolveReminderTime(
        local,
        customerTimeZone('NY'),
        now,
      ).dueAt.toISOString(),
    ).toBe('2026-07-01T20:00:00.000Z');
    expect(
      resolveReminderTime(
        local,
        customerTimeZone('CA'),
        now,
      ).dueAt.toISOString(),
    ).toBe('2026-07-01T23:00:00.000Z');
  });
  it('uses daylight saving by date and keeps Arizona on its fixed offset', () => {
    expect(
      resolveReminderTime(
        '2026-07-01T10:00',
        'America/Denver',
        now,
      ).dueAt.toISOString(),
    ).toBe('2026-07-01T16:00:00.000Z');
    expect(
      resolveReminderTime(
        '2026-07-01T10:00',
        'America/Phoenix',
        now,
      ).dueAt.toISOString(),
    ).toBe('2026-07-01T17:00:00.000Z');
    expect(
      resolveReminderTime(
        '2026-12-01T10:00',
        'America/Los_Angeles',
        now,
      ).dueAt.toISOString(),
    ).toBe('2026-12-01T18:00:00.000Z');
  });
  it('rejects nonexistent spring-forward times', () => {
    expect(() =>
      resolveReminderTime('2026-03-08T02:30', 'America/New_York', now),
    ).toThrow('does not exist');
  });
  it('requires explicit disambiguation for fall-back times', () => {
    expect(() =>
      resolveReminderTime('2026-11-01T01:30', 'America/Los_Angeles', now),
    ).toThrow('occurs twice');
    expect(
      resolveReminderTime(
        '2026-11-01T01:30',
        'America/Los_Angeles',
        now,
        -420,
      ).dueAt.toISOString(),
    ).toBe('2026-11-01T08:30:00.000Z');
    expect(
      resolveReminderTime(
        '2026-11-01T01:30',
        'America/Los_Angeles',
        now,
        -480,
      ).dueAt.toISOString(),
    ).toBe('2026-11-01T09:30:00.000Z');
  });
  it.each([
    '2026-02-30T10:00',
    '2026-01-02T24:00',
    '2026-00-01T10:00',
    '2026-01-02',
    'invalid',
  ])('rejects invalid wall clock %s', (local) => {
    expect(() => resolveReminderTime(local, 'America/Chicago', now)).toThrow();
  });
  it('rejects past, equal, unsupported-zone, and forged-offset schedules', () => {
    expect(() =>
      resolveReminderTime(
        '2026-01-01T00:00',
        'America/Chicago',
        new Date('2026-01-01T06:00Z'),
      ),
    ).toThrow('future');
    expect(() =>
      resolveReminderTime('2025-01-01T00:00', 'America/Chicago', now),
    ).toThrow('future');
    expect(() => resolveReminderTime('2026-07-01T10:00', 'UTC', now)).toThrow(
      'Unsupported',
    );
    expect(() =>
      resolveReminderTime('2026-07-01T10:00', 'America/Chicago', now, -360),
    ).toThrow('offset');
  });
});
