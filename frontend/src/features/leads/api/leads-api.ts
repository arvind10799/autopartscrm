'use client';

import { axiosBrowser } from '@/lib/api/axios-browser';
import { parseApiData } from '@/lib/api/parse-api-data';
import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import {
  createLeadSchema,
  leadAgentsSchema,
  leadsListSchema,
  leadSummarySchema,
  updateLeadSchema,
} from '../schemas/lead.schema';
import { normalizeLeadsListQuery } from '../lib/leads.helpers';
import type {
  CreateLeadInput,
  LeadUser,
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

  async exportExcel(params: LeadsListQuery): Promise<void> {
    const normalizedParams = normalizeLeadsListQuery(params);
    const response = await axiosBrowser.get<Blob>('/api/leads/export.xlsx', {
      params: normalizedParams,
      responseType: 'blob',
    });
    const filename =
      getDownloadFilename(response.headers['content-disposition']) ??
      `leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

  async listAgents(): Promise<LeadUser[]> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/leads/agents',
    );

    return parseApiData(response, leadAgentsSchema, {
      emptyMessage: response.data.message || 'Lead agents response was empty.',
      invalidMessage: 'Lead agents response payload was invalid.',
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

function getDownloadFilename(contentDisposition: unknown): string | null {
  if (typeof contentDisposition !== 'string') {
    return null;
  }

  const utf8FilenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainFilenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  const filename = utf8FilenameMatch?.[1] ?? plainFilenameMatch?.[1];

  return filename ? decodeURIComponent(filename) : null;
}
