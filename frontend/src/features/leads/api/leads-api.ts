'use client';

import { axiosBrowser } from '@/lib/api/axios-browser';
import { parseApiData } from '@/lib/api/parse-api-data';
import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import {
  createLeadSchema,
  leadsListSchema,
  leadSummarySchema,
  updateLeadSchema,
} from '../schemas/lead.schema';
import { normalizeLeadsListQuery } from '../lib/leads.helpers';
import type {
  CreateLeadInput,
  LeadsListQuery,
  LeadsListResponse,
  LeadSummary,
  UpdateLeadInput,
} from '../types/lead.types';

export const leadsApi = {
  async list(params: LeadsListQuery): Promise<LeadsListResponse> {
    const normalizedParams = normalizeLeadsListQuery(params);
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>('/api/leads', {
      params: normalizedParams,
    });

    return parseApiData(response, leadsListSchema, {
      emptyMessage: response.data.message || 'Leads response was empty.',
      invalidMessage: 'Leads response payload was invalid.',
    });
  },

  async create(payload: CreateLeadInput): Promise<LeadSummary> {
    const requestPayload = createLeadSchema.parse(payload);
    const response = await axiosBrowser.post<ApiEnvelope<unknown>>(
      '/api/leads',
      requestPayload,
    );

    return parseApiData(response, leadSummarySchema, {
      emptyMessage: response.data.message || 'Create lead response was empty.',
      invalidMessage: 'Create lead response payload was invalid.',
    });
  },

  async update(leadId: string, payload: UpdateLeadInput): Promise<LeadSummary> {
    const requestPayload = updateLeadSchema.parse(payload);
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/leads/${leadId}`,
      requestPayload,
    );

    return parseApiData(response, leadSummarySchema, {
      emptyMessage: response.data.message || 'Update lead response was empty.',
      invalidMessage: 'Update lead response payload was invalid.',
    });
  },
};
