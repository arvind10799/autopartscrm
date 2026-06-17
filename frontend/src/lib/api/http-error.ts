import axios from 'axios';
import { API_ERROR_MESSAGES } from '@/lib/constants/api';
import { parseResponseMessage } from './api-envelope';

export class HttpError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return new HttpError(API_ERROR_MESSAGES.timeout, error.response?.status);
    }

    const message =
      parseResponseMessage(error.response?.data) ??
      (error.response ? undefined : API_ERROR_MESSAGES.network) ??
      error.message ??
      API_ERROR_MESSAGES.requestFailed;

    return new HttpError(message, error.response?.status);
  }

  if (error instanceof Error) {
    return new HttpError(error.message);
  }

  return new HttpError(API_ERROR_MESSAGES.unexpected);
}
