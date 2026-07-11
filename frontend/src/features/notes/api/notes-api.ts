'use client';

import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import type { TimestampRangeQuery } from '@/lib/filters/date-range';
import { isValidOrderId } from '@/features/orders/lib/orders.helpers';
import { isValidShipmentId } from '@/features/shipments/lib/shipments.helpers';
import { axiosBrowser } from '@/lib/api/axios-browser';
import { HttpError } from '@/lib/api/http-error';
import { parseApiData } from '@/lib/api/parse-api-data';
import {
  createNoteSchema,
  noteSchema,
  notesListSchema,
} from '../schemas/note.schema';
import type {
  CreateNoteInput,
  NoteEntityType,
  NoteRecord,
} from '../types/note.types';

export const notesApi = {
  async listByEntity(
    entityType: NoteEntityType,
    entityId: string,
    params: TimestampRangeQuery = {},
  ): Promise<NoteRecord[]> {
    assertValidEntityReference(entityType, entityId);

    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      `/api/notes/entity/${entityType}/${entityId}`,
      {
        params,
      },
    );

    return parseApiData(response, notesListSchema, {
      emptyMessage: response.data.message || 'Notes response was empty.',
      invalidMessage: 'Notes response payload was invalid.',
    });
  },

  async create(payload: CreateNoteInput): Promise<NoteRecord> {
    const requestPayload = createNoteSchema.parse(payload);
    assertValidEntityReference(
      requestPayload.entityType,
      requestPayload.entityId,
    );

    const response = await axiosBrowser.post<ApiEnvelope<unknown>>(
      '/api/notes',
      requestPayload,
    );

    return parseApiData(response, noteSchema, {
      emptyMessage: response.data.message || 'Create note response was empty.',
      invalidMessage: 'Create note response payload was invalid.',
    });
  },
};

function assertValidEntityReference(
  entityType: NoteEntityType,
  entityId: string,
) {
  if (entityType === 'ORDER' && !isValidOrderId(entityId)) {
    throw new HttpError('Order identifier is invalid.', 400);
  }

  if (entityType === 'SHIPMENT' && !isValidShipmentId(entityId)) {
    throw new HttpError('Shipment identifier is invalid.', 400);
  }
}
