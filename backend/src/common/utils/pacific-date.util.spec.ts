import {
  formatPacificTimestamp,
  parsePacificDateInputValue,
} from './pacific-date.util';

describe('Pacific export timestamps', () => {
  it.each([
    ['2026-01-01T01:00:00Z', '12/31/2025, 05:00:00 PM PST'],
    ['2026-03-08T10:00:00Z', '03/08/2026, 03:00:00 AM PDT'],
    ['2026-11-01T08:15:00Z', '11/01/2026, 01:15:00 AM PDT'],
    ['2026-11-01T09:15:00Z', '11/01/2026, 01:15:00 AM PST'],
  ])('formats %s for the workbook', (value, expected) => {
    expect(formatPacificTimestamp(new Date(value)).replace(/\s/g, ' ')).toBe(
      expected,
    );
  });
  it('leaves the timestamp blank for an unconverted lead', () => {
    expect(formatPacificTimestamp(null)).toBe('');
  });
});

describe('parsePacificDateInputValue', () => {
  it('keeps a date-only value on the same Pacific calendar day', () => {
    const parsedDate = parsePacificDateInputValue('2026-10-01');

    expect(parsedDate.toISOString()).toBe('2026-10-01T12:00:00.000Z');
    expect(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(parsedDate),
    ).toBe('2026-10-01');
  });
});
