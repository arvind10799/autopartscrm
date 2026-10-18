import {
  buildTimestampRangeQuery,
  type DateRangeFilterState,
  type TimestampRangeQuery,
} from '@/lib/filters/date-range';
import { getPacificTodayDateInputValue } from '@/lib/utils/pacific-date';

const pacificPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function pacificDayStart(date: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const [year, month, day] = date.split('-').map(Number);
  const midnightUtc = Date.UTC(year, month - 1, day);
  if (new Date(midnightUtc).toISOString().slice(0, 10) !== date) {
    return undefined;
  }

  // Resolve Pacific midnight from its wall-clock parts; the offset can change
  // between the start and end of a daylight-saving transition day.
  let instant = midnightUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      pacificPartsFormatter
        .formatToParts(new Date(instant))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    );
    const wallClockUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    instant += midnightUtc - wallClockUtc;
  }
  return new Date(instant);
}

export function buildWebsiteLeadSubmittedRangeQuery(
  filter: DateRangeFilterState,
  now = new Date(),
): TimestampRangeQuery {
  if (filter.preset === 'ALL' || filter.preset === 'LAST_7_DAYS' || filter.preset === 'LAST_30_DAYS') {
    return buildTimestampRangeQuery(filter, now);
  }

  const today = getPacificTodayDateInputValue(now);
  const from = filter.preset === 'TODAY'
    ? today
    : filter.preset === 'YESTERDAY'
      ? shiftDate(today, -1)
      : filter.from;
  const to = filter.preset === 'TODAY'
    ? today
    : filter.preset === 'YESTERDAY'
      ? shiftDate(today, -1)
      : filter.to;
  const start = from ? pacificDayStart(from) : undefined;
  const nextStart = to && pacificDayStart(to)
    ? pacificDayStart(shiftDate(to, 1))
    : undefined;

  return {
    createdFrom: start?.toISOString(),
    createdTo: filter.preset === 'TODAY'
      ? now.toISOString()
      : nextStart
        ? new Date(nextStart.getTime() - 1).toISOString()
        : undefined,
  };
}
