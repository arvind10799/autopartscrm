'use client';

import { z } from 'zod';
import { axiosBrowser } from '@/lib/api/axios-browser';
import { parseApiData } from '@/lib/api/parse-api-data';
import { CURRENT_RELEASE } from '@/lib/config/current-release';
import type { ApiEnvelope } from '@/features/auth/types/auth.types';

const seenSchema = z.object({ seen: z.boolean() });
const url = `/api/releases/${encodeURIComponent(CURRENT_RELEASE.id)}/seen`;

export const releasesApi = {
  async hasSeen(): Promise<boolean> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(url);
    return parseApiData(response, seenSchema, {
      emptyMessage: 'Release status was empty.',
      invalidMessage: 'Release status was invalid.',
    }).seen;
  },

  async markSeen(): Promise<void> {
    const response = await axiosBrowser.put<ApiEnvelope<unknown>>(url);
    parseApiData(response, seenSchema, {
      emptyMessage: 'Release acknowledgement was empty.',
      invalidMessage: 'Release acknowledgement was invalid.',
    });
  },
};
