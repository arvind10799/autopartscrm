import { z } from 'zod';

export const DATE_RANGE_PRESETS = [
  'ALL',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'CUSTOM',
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export type TimestampRangeQuery = {
  createdFrom?: string;
  createdTo?: string;
};

export type DateRangeFilterState = {
  preset: DateRangePreset;
  from: string;
  to: string;
};

const isoDateTimeSchema = z.string().datetime({ offset: true });
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export function createDefaultDateRangeFilterState(): DateRangeFilterState {
  return {
    preset: 'ALL',
    from: '',
    to: '',
  };
}

export function buildTimestampRangeQuery(
  filter: DateRangeFilterState,
  now = new Date(),
): TimestampRangeQuery {
  if (filter.preset === 'ALL') {
    return {};
  }

  if (filter.preset === 'LAST_7_DAYS') {
    return {
      createdFrom: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdTo: now.toISOString(),
    };
  }

  if (filter.preset === 'LAST_30_DAYS') {
    return {
      createdFrom: new Date(
        now.getTime() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      createdTo: now.toISOString(),
    };
  }

  const createdFrom = normalizeLocalDateValue(filter.from, 'start');
  const createdTo = normalizeLocalDateValue(filter.to, 'end');

  return {
    createdFrom,
    createdTo,
  };
}

export function normalizeTimestampRangeQuery(
  input: TimestampRangeQuery,
): TimestampRangeQuery {
  const createdFrom = normalizeIsoDateTime(input.createdFrom);
  const createdTo = normalizeIsoDateTime(input.createdTo);

  return {
    createdFrom,
    createdTo,
  };
}

export function buildDateRangeSearchParams(
  searchParams: URLSearchParams,
  query: TimestampRangeQuery,
): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);

  if (query.createdFrom) {
    nextSearchParams.set('createdFrom', query.createdFrom);
  }

  if (query.createdTo) {
    nextSearchParams.set('createdTo', query.createdTo);
  }

  return nextSearchParams;
}

export function readTimestampRangeQueryFromSearchParams(
  searchParams: URLSearchParams,
): TimestampRangeQuery {
  return normalizeTimestampRangeQuery({
    createdFrom: searchParams.get('createdFrom') ?? undefined,
    createdTo: searchParams.get('createdTo') ?? undefined,
  });
}

function normalizeIsoDateTime(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  return isoDateTimeSchema.safeParse(trimmedValue).success
    ? trimmedValue
    : undefined;
}

function normalizeLocalDateValue(
  value: string,
  boundary: 'start' | 'end',
): string | undefined {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  if (!isoDateSchema.safeParse(trimmedValue).success) {
    return undefined;
  }

  const [year, month, day] = trimmedValue.split('-').map(Number);
  const normalizedDate =
    boundary === 'start'
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);

  if (Number.isNaN(normalizedDate.getTime())) {
    return undefined;
  }

  return normalizedDate.toISOString();
}
