'use client';

import { z } from 'zod';
import { axiosBrowser } from '@/lib/api/axios-browser';
import { parseApiData } from '@/lib/api/parse-api-data';
import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import type { CreateLeadInput } from '@/features/leads/types/lead.types';
import { leadSummarySchema } from '@/features/leads/schemas/lead.schema';
import type { LeadSummary } from '@/features/leads/types/lead.types';

export const WEBSITE_LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'CLOSED',
  'CONVERTED',
] as const;
export type WebsiteLeadStatus = (typeof WEBSITE_LEAD_STATUSES)[number];

const agentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['ADMIN', 'SALES']),
});
const websiteLeadSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(['QUOTE', 'PART_REQUEST']),
  sourceFormId: z.string(),
  sourcePageUrl: z.string().nullable(),
  externalSubmissionId: z.string(),
  submittedAt: z.string(),
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  customerEmail: z.string().nullable(),
  state: z.string().nullable(),
  zipCode: z.string().nullable(),
  vehicleYear: z.string().nullable(),
  vehicleMake: z.string().nullable(),
  vehicleModel: z.string().nullable(),
  vin: z.string().nullable(),
  partRequested: z.string().nullable(),
  message: z.string().nullable(),
  smsOptIn: z.boolean().nullable(),
  status: z.enum(WEBSITE_LEAD_STATUSES),
  assignedToId: z.string().uuid().nullable(),
  assignedTo: agentSchema.nullable(),
  convertedLeadId: z.string().uuid().nullable(),
  convertedLead: z
    .object({ id: z.string().uuid(), customerName: z.string() })
    .nullable(),
  convertedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const noteSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
  }),
});
const listSchema = z.object({
  items: z.array(websiteLeadSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
});

export type WebsiteLead = z.infer<typeof websiteLeadSchema>;
export type WebsiteLeadNote = z.infer<typeof noteSchema>;
export type WebsiteLeadAgent = z.infer<typeof agentSchema>;
export type WebsiteLeadList = z.infer<typeof listSchema>;

export const websiteLeadsApi = {
  async list(params: {
    page: number;
    limit: number;
    search?: string;
    status?: WebsiteLeadStatus;
    assignedToId?: string;
  }): Promise<WebsiteLeadList> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/website-leads',
      { params },
    );
    return parseApiData(response, listSchema, {
      emptyMessage: 'Website leads response was empty.',
      invalidMessage: 'Website leads response was invalid.',
    });
  },
  async agents(): Promise<WebsiteLeadAgent[]> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/website-leads/agents',
    );
    return parseApiData(response, z.array(agentSchema), {
      emptyMessage: 'Agents response was empty.',
      invalidMessage: 'Agents response was invalid.',
    });
  },
  async get(id: string): Promise<WebsiteLead> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      `/api/website-leads/${id}`,
    );
    return parseApiData(response, websiteLeadSchema, {
      emptyMessage: 'Website lead was not found.',
      invalidMessage: 'Website lead response was invalid.',
    });
  },
  async update(
    id: string,
    payload: { status?: WebsiteLeadStatus; assignedToId?: string | null },
  ): Promise<WebsiteLead> {
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/website-leads/${id}`,
      payload,
    );
    return parseApiData(response, websiteLeadSchema, {
      emptyMessage: 'Website lead update was empty.',
      invalidMessage: 'Website lead update was invalid.',
    });
  },
  async notes(id: string): Promise<WebsiteLeadNote[]> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      `/api/website-leads/${id}/notes`,
    );
    return parseApiData(response, z.array(noteSchema), {
      emptyMessage: 'Notes response was empty.',
      invalidMessage: 'Notes response was invalid.',
    });
  },
  async addNote(id: string, content: string): Promise<WebsiteLeadNote> {
    const response = await axiosBrowser.post<ApiEnvelope<unknown>>(
      `/api/website-leads/${id}/notes`,
      { content },
    );
    return parseApiData(response, noteSchema, {
      emptyMessage: 'Note response was empty.',
      invalidMessage: 'Note response was invalid.',
    });
  },
  async convert(id: string, payload: CreateLeadInput): Promise<LeadSummary> {
    const response = await axiosBrowser.post<ApiEnvelope<unknown>>(
      `/api/website-leads/${id}/convert`,
      payload,
    );
    return parseApiData(response, leadSummarySchema, {
      emptyMessage: 'Conversion response was empty.',
      invalidMessage: 'Conversion response was invalid.',
    });
  },
};
