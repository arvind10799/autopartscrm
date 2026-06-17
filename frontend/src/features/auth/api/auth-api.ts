'use client';

import { axiosBrowser } from '@/lib/api/axios-browser';
import { assertApiSuccess, parseApiData } from '@/lib/api/parse-api-data';
import { clientSessionSchema } from '../schemas/session.schema';
import type {
  ApiEnvelope,
  ClientSession,
  LoginPayload,
} from '../types/auth.types';

export const authApi = {
  async login(payload: LoginPayload): Promise<ClientSession> {
    const response = await axiosBrowser.post<ApiEnvelope<unknown>>(
      '/api/auth/login',
      payload,
    );

    return parseApiData(response, clientSessionSchema, {
      emptyMessage: 'Login response was empty.',
      invalidMessage: 'Login response payload was invalid.',
    });
  },

  async getSession(): Promise<ClientSession> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/auth/session',
    );

    return parseApiData(response, clientSessionSchema, {
      emptyMessage: 'Session response was empty.',
      invalidMessage: 'Session response payload was invalid.',
    });
  },

  async logout(): Promise<void> {
    const response = await axiosBrowser.post('/api/auth/logout');
    assertApiSuccess(response, 'Logout failed.');
  },
};
