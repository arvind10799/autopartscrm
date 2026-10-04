import { parsePacificDateInputValue } from './pacific-date.util';

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
