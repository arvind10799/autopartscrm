'use client';

import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import { axiosBrowser } from '@/lib/api/axios-browser';
import { parseApiData } from '@/lib/api/parse-api-data';
import { HttpError } from '@/lib/api/http-error';
import { isValidShipmentId } from '@/features/shipments/lib/shipments.helpers';
import {
  shipmentCostSchema,
} from '../schemas/cost.schema';
import type {
  CreateShipmentCostInput,
  ShipmentCostRecord,
  UpdateShipmentCostInput,
} from '../types/cost.types';

export const costsApi = {
  async getByShipmentId(shipmentId: string): Promise<ShipmentCostRecord> {
    if (!isValidShipmentId(shipmentId)) {
      throw new HttpError('Shipment identifier is invalid.', 400);
    }

    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      `/api/costs/shipment/${shipmentId}`,
    );

    return parseApiData(response, shipmentCostSchema, {
      emptyMessage: response.data.message || 'Shipment cost response was empty.',
      invalidMessage: 'Shipment cost response payload was invalid.',
    });
  },

  async create(payload: CreateShipmentCostInput): Promise<ShipmentCostRecord> {
    const response = await axiosBrowser.post<ApiEnvelope<unknown>>(
      '/api/costs',
      payload,
    );

    return parseApiData(response, shipmentCostSchema, {
      emptyMessage: response.data.message || 'Create cost response was empty.',
      invalidMessage: 'Create cost response payload was invalid.',
    });
  },

  async updateByShipmentId(
    shipmentId: string,
    payload: UpdateShipmentCostInput,
  ): Promise<ShipmentCostRecord> {
    if (!isValidShipmentId(shipmentId)) {
      throw new HttpError('Shipment identifier is invalid.', 400);
    }

    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/costs/shipment/${shipmentId}`,
      payload,
    );

    return parseApiData(response, shipmentCostSchema, {
      emptyMessage: response.data.message || 'Update cost response was empty.',
      invalidMessage: 'Update cost response payload was invalid.',
    });
  },
};
