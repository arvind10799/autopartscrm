import { z } from 'zod';
import {
  buildDateRangeSearchParams,
  normalizeTimestampRangeQuery,
  readTimestampRangeQueryFromSearchParams,
} from '@/lib/filters/date-range';
import type {
  CreateLeadInput,
  LeadStatus,
  LeadsListQuery,
  LeadsListResponse,
} from '../types/lead.types';

export const LEAD_PAGE_SIZE = 10;
export const ALL_LEAD_CONVERSION_FILTER = 'ALL' as const;
export const ALL_LEAD_STATUS_FILTER = 'ALL' as const;

export type LeadConversionFilter =
  | typeof ALL_LEAD_CONVERSION_FILTER
  | 'OPEN'
  | 'CONVERTED';

export type LeadStatusFilter =
  | typeof ALL_LEAD_STATUS_FILTER
  | LeadStatus;

const positiveIntegerSchema = z.coerce.number().int().min(1);
const searchTermSchema = z
  .string()
  .trim()
  .max(160)
  .transform((value) => (value.length > 0 ? value : undefined));

export type NormalizedLeadsQuery = {
  page: number;
  limit: number;
  search?: string;
  converted?: boolean;
  status?: LeadStatus;
  createdFrom?: string;
  createdTo?: string;
};

export function createEmptyLeadsResponse(
  page = 1,
  limit = LEAD_PAGE_SIZE,
): LeadsListResponse {
  return {
    items: [],
    meta: {
      page,
      limit,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

export function parseLeadConversionFilter(value: string): LeadConversionFilter {
  if (value === 'OPEN' || value === 'CONVERTED') {
    return value;
  }

  return ALL_LEAD_CONVERSION_FILTER;
}

export function formatLeadConversionFilterLabel(value: LeadConversionFilter): string {
  if (value === 'OPEN') {
    return 'Open leads';
  }

  if (value === 'CONVERTED') {
    return 'Converted leads';
  }

  return 'All leads';
}

export function parseLeadStatusFilter(value: string): LeadStatusFilter {
  if (
    value === 'PROSPECT' ||
    value === 'CALL_BACK_LATER' ||
    value === 'NOT_INTERESTED' ||
    value === 'NEEDS_LOCALLY'
  ) {
    return value;
  }

  return ALL_LEAD_STATUS_FILTER;
}

export function formatLeadStatusLabel(value: LeadStatus): string {
  const labels: Record<LeadStatus, string> = {
    PROSPECT: 'Prospect',
    CALL_BACK_LATER: 'Call back later',
    NOT_INTERESTED: 'Not Interested',
    NEEDS_LOCALLY: 'Needs locally',
  };

  return labels[value];
}

export function parseLeadsQueryParams(
  searchParams: URLSearchParams,
): NormalizedLeadsQuery {
  const timestampRange = readTimestampRangeQueryFromSearchParams(searchParams);
  const page = positiveIntegerSchema.catch(1).parse(searchParams.get('page'));
  const limit = positiveIntegerSchema
    .max(100)
    .catch(LEAD_PAGE_SIZE)
    .parse(searchParams.get('limit'));
  const search = searchTermSchema.catch(undefined).parse(searchParams.get('search'));
  const convertedValue = searchParams.get('converted');
  const status = parseLeadStatusFilter(searchParams.get('status') ?? '');

  return {
    page,
    limit,
    search,
    converted:
      convertedValue === 'true'
        ? true
        : convertedValue === 'false'
          ? false
          : undefined,
    status: status === ALL_LEAD_STATUS_FILTER ? undefined : status,
    createdFrom: timestampRange.createdFrom,
    createdTo: timestampRange.createdTo,
  };
}

export function buildLeadsQueryString(query: NormalizedLeadsQuery): string {
  const baseSearchParams = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });

  if (query.search) {
    baseSearchParams.set('search', query.search);
  }

  if (query.converted !== undefined) {
    baseSearchParams.set('converted', String(query.converted));
  }

  if (query.status) {
    baseSearchParams.set('status', query.status);
  }

  return buildDateRangeSearchParams(baseSearchParams, query).toString();
}

export function normalizeLeadsListQuery(input: LeadsListQuery): LeadsListQuery {
  const timestampRange = normalizeTimestampRangeQuery({
    createdFrom: input.createdFrom,
    createdTo: input.createdTo,
  });

  return {
    page: input.page,
    limit: input.limit,
    search: input.search?.trim() || undefined,
    converted: input.converted,
    status: input.status,
    createdFrom: timestampRange.createdFrom,
    createdTo: timestampRange.createdTo,
  };
}

export function toBackendCreateLeadPayload(lead: CreateLeadInput) {
  return {
    leadDate: lead.leadDate,
    cmpt: lead.cmpt,
    customerPhone: lead.customerPhone,
    customerName: lead.customerName,
    partDescription: lead.partDescription,
    quote: lead.quote,
    comments: lead.comments,
    prospects: lead.prospects,
    status: lead.status,
  };
}
