'use client';

import { axiosBrowser } from '@/lib/api/axios-browser';
import { parseApiData } from '@/lib/api/parse-api-data';
import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import {
  createReplacementSchema,
  replacementRequestSchema,
  replacementsListSchema,
  updateReplacementSchema,
} from '../schemas/replacement.schema';
import type {
  CreateReplacementInput,
  ReplacementRequest,
  ReplacementsListQuery,
  ReplacementsListResponse,
  UpdateReplacementInput,
} from '../types/replacement.types';
import { normalizeReplacementsListQuery } from '../lib/replacements.helpers';

export const replacementsApi = {
  async list(params: ReplacementsListQuery): Promise<ReplacementsListResponse> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/replacements',
      {
        params: normalizeReplacementsListQuery(params),
      },
    );

    return parseApiData(response, replacementsListSchema, {
      emptyMessage: response.data.message || 'Replacement orders response was empty.',
      invalidMessage: 'Replacement orders response payload was invalid.',
    });
  },

  async create(payload: CreateReplacementInput): Promise<ReplacementRequest> {
    const requestPayload = createReplacementSchema.parse(payload);
    const response = await axiosBrowser.post<ApiEnvelope<unknown>>(
      '/api/replacements',
      requestPayload,
    );

    return parseApiData(response, replacementRequestSchema, {
      emptyMessage: response.data.message || 'Create replacement response was empty.',
      invalidMessage: 'Create replacement response payload was invalid.',
    });
  },

  async getById(replacementId: string): Promise<ReplacementRequest> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      `/api/replacements/${replacementId}`,
    );

    return parseApiData(response, replacementRequestSchema, {
      emptyMessage: response.data.message || 'Replacement details response was empty.',
      invalidMessage: 'Replacement details response payload was invalid.',
    });
  },

  async update(
    replacementId: string,
    payload: UpdateReplacementInput,
  ): Promise<ReplacementRequest> {
    const requestPayload = updateReplacementSchema.parse(payload);
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/replacements/${replacementId}`,
      requestPayload,
    );

    return parseApiData(response, replacementRequestSchema, {
      emptyMessage: response.data.message || 'Update replacement response was empty.',
      invalidMessage: 'Update replacement response payload was invalid.',
    });
  },
};
