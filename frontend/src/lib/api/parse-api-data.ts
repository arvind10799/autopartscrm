import type { AxiosResponse } from 'axios';
import { z, type ZodTypeAny } from 'zod';
import { API_ERROR_MESSAGES } from '@/lib/constants/api';
import { parseApiEnvelope } from './api-envelope';
import { HttpError } from './http-error';

type ParseApiDataOptions = {
  emptyMessage: string;
  invalidMessage: string;
  envelopeMessage?: string;
};

export function parseApiData<TSchema extends ZodTypeAny>(
  response: AxiosResponse<unknown>,
  schema: TSchema,
  options: ParseApiDataOptions,
): z.output<TSchema> {
  const envelope = parseApiEnvelope<unknown>(response.data);

  if (!envelope) {
    throw new HttpError(
      options.envelopeMessage ?? API_ERROR_MESSAGES.invalidEnvelope,
      response.status,
    );
  }

  if (!envelope.success) {
    throw new HttpError(
      envelope.message || API_ERROR_MESSAGES.requestFailed,
      response.status,
    );
  }

  if (envelope.data === null) {
    throw new HttpError(
      envelope.message || options.emptyMessage || API_ERROR_MESSAGES.emptyData,
      response.status,
    );
  }

  const parsedData = schema.safeParse(envelope.data);

  if (!parsedData.success) {
    throw new HttpError(
      options.invalidMessage || API_ERROR_MESSAGES.invalidData,
      response.status,
    );
  }

  return parsedData.data;
}

export function assertApiSuccess(
  response: AxiosResponse<unknown>,
  fallbackMessage: string = API_ERROR_MESSAGES.requestFailed,
) {
  const envelope = parseApiEnvelope<unknown>(response.data);

  if (!envelope) {
    throw new HttpError(API_ERROR_MESSAGES.invalidEnvelope, response.status);
  }

  if (!envelope.success) {
    throw new HttpError(envelope.message || fallbackMessage, response.status);
  }
}
