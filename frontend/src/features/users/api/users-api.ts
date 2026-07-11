'use client';

import { axiosBrowser } from '@/lib/api/axios-browser';
import { parseApiData, assertApiSuccess } from '@/lib/api/parse-api-data';
import type { TimestampRangeQuery } from '@/lib/filters/date-range';
import {
  updateUserPasswordPayloadSchema,
  updateUserSchema,
  userListSchema,
} from '../schemas/user.schema';
import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import type {
  CreateUserPayload,
  UpdateUserPasswordPayload,
  UpdateUserPayload,
  UserRecord,
} from '../types/user.types';

export const usersApi = {
  async create(payload: CreateUserPayload): Promise<UserRecord> {
    const response = await axiosBrowser.post<ApiEnvelope<unknown>>(
      '/api/users',
      payload,
    );

    assertApiSuccess(response, 'Failed to create user.');

    // The backend returns the created user in data
    const envelope = response.data as ApiEnvelope<UserRecord>;
    if (!envelope.data) {
      throw new Error('User creation response was empty.');
    }
    return envelope.data;
  },

  async list(params: TimestampRangeQuery = {}): Promise<UserRecord[]> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/users',
      {
        params,
      },
    );

    return parseApiData(response, userListSchema, {
      emptyMessage: 'Users response was empty.',
      invalidMessage: 'Users response payload was invalid.',
    });
  },

  async updatePassword(
    userId: string,
    payload: UpdateUserPasswordPayload,
  ): Promise<UserRecord> {
    const requestPayload = updateUserPasswordPayloadSchema.parse(payload);
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/users/${userId}/password`,
      requestPayload,
    );

    assertApiSuccess(response, 'Failed to update password.');

    const envelope = response.data as ApiEnvelope<UserRecord>;
    if (!envelope.data) {
      throw new Error('Password update response was empty.');
    }

    return envelope.data;
  },

  async update(userId: string, payload: UpdateUserPayload): Promise<UserRecord> {
    const requestPayload = updateUserSchema.parse(payload);
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/users/${userId}`,
      requestPayload,
    );

    assertApiSuccess(response, 'Failed to update user.');
    const envelope = response.data as ApiEnvelope<UserRecord>;
    if (!envelope.data) {
      throw new Error('User update response was empty.');
    }
    return envelope.data;
  },

  async delete(userId: string): Promise<void> {
    const response = await axiosBrowser.delete<ApiEnvelope<unknown>>(
      `/api/users/${userId}`,
    );
    assertApiSuccess(response, 'Failed to delete user.');
  },
};
