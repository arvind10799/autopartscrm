const PACIFIC_TIME_ZONE = 'America/Los_Angeles';
const PACIFIC_TIME_ZONE_LABEL = 'PDT';

export function parseStoredDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day, 12));
  }

  return new Date(value);
}

export const pacificDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PACIFIC_TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const pacificDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PACIFIC_TIME_ZONE,
  dateStyle: 'medium',
});

export const pacificShortDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PACIFIC_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatPacificDateTime(
  value: string | null | undefined,
  fallback = 'Unknown time',
): string {
  if (!value) {
    return fallback;
  }

  const parsedDate = parseStoredDate(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return fallback;
  }

  return `${pacificDateTimeFormatter.format(parsedDate)} ${PACIFIC_TIME_ZONE_LABEL}`;
}

export function formatPacificDate(
  value: string | null | undefined,
  fallback = 'Unknown',
): string {
  if (!value) {
    return fallback;
  }

  const parsedDate = parseStoredDate(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return fallback;
  }

  return `${pacificDateFormatter.format(parsedDate)} ${PACIFIC_TIME_ZONE_LABEL}`;
}

export function formatPacificShortDateTime(
  value: string | null | undefined,
  fallback = 'Date unavailable',
): string {
  if (!value) {
    return fallback;
  }

  const parsedDate = parseStoredDate(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return fallback;
  }

  return `${pacificShortDateFormatter.format(parsedDate)} ${PACIFIC_TIME_ZONE_LABEL}`;
}

export function formatPacificDateOnly(
  value: string | null | undefined,
  fallback = '',
): string {
  if (!value) {
    return fallback;
  }

  const parsedDate = parseStoredDate(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return fallback;
  }

  return pacificDateFormatter.format(parsedDate);
}

export function getPacificTodayDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function isFuturePacificDate(value: string) {
  return value > getPacificTodayDateInputValue();
}
