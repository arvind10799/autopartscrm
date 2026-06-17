'use client';

import { axiosBrowser } from '@/lib/api/axios-browser';
import { parseApiData } from '@/lib/api/parse-api-data';
import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import { HttpError } from '@/lib/api/http-error';
import {
  isValidShipmentId,
  normalizeShipmentsListQuery,
  toUpdateShipmentStatusPayload,
} from '../lib/shipments.helpers';
import {
  createShipmentSchema,
  shipmentDetailSchema,
  shipmentsListSchema,
  shipmentSummarySchema,
  shipmentTimelineSchema,
  updateShipmentStatusSchema,
} from '../schemas/shipment.schema';
import type {
  ShipmentDetail,
  ShipmentSummary,
  ShipmentTimeline,
  ShipmentsListQuery,
  UpdateShipmentStatusInput,
  ShipmentsListResponse,
} from '../types/shipment.types';
import type { CreateShipmentPayload } from '../schemas/shipment.schema';

export const shipmentsApi = {
  async list(params: ShipmentsListQuery): Promise<ShipmentsListResponse> {
    const normalizedParams = normalizeShipmentsListQuery(params);
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>('/api/shipments', {
      params: normalizedParams,
    });

    return parseApiData(response, shipmentsListSchema, {
      emptyMessage: response.data.message || 'Shipments response was empty.',
      invalidMessage: 'Shipments response payload was invalid.',
    });
  },

  async create(payload: CreateShipmentPayload): Promise<ShipmentSummary> {
    const requestPayload = createShipmentSchema.parse(payload);
    const response = await axiosBrowser.post<ApiEnvelope<unknown>>(
      '/api/shipments',
      requestPayload,
    );

    return parseApiData(response, shipmentSummarySchema, {
      emptyMessage: response.data.message || 'Create shipment response was empty.',
      invalidMessage: 'Create shipment response payload was invalid.',
    });
  },

  async getById(shipmentId: string): Promise<ShipmentDetail> {
    if (!isValidShipmentId(shipmentId)) {
      throw new HttpError('Shipment identifier is invalid.', 400);
    }

    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      `/api/shipments/${shipmentId}`,
    );

    return parseApiData(response, shipmentDetailSchema, {
      emptyMessage: response.data.message || 'Shipment details response was empty.',
      invalidMessage: 'Shipment details response payload was invalid.',
    });
  },

  async getTimeline(shipmentId: string): Promise<ShipmentTimeline> {
    if (!isValidShipmentId(shipmentId)) {
      throw new HttpError('Shipment identifier is invalid.', 400);
    }

    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      `/api/tracking/shipment/${shipmentId}/timeline`,
    );

    return parseApiData(response, shipmentTimelineSchema, {
      emptyMessage: response.data.message || 'Shipment timeline response was empty.',
      invalidMessage: 'Shipment timeline response payload was invalid.',
    });
  },

  async updateStatus(
    shipmentId: string,
    payload: UpdateShipmentStatusInput,
  ): Promise<ShipmentSummary> {
    if (!isValidShipmentId(shipmentId)) {
      throw new HttpError('Shipment identifier is invalid.', 400);
    }

    const requestPayload = updateShipmentStatusSchema.parse(payload);
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/shipments/${shipmentId}/status`,
      toUpdateShipmentStatusPayload(requestPayload),
    );

    return parseApiData(response, shipmentSummarySchema, {
      emptyMessage: response.data.message || 'Shipment status response was empty.',
      invalidMessage: 'Shipment status response payload was invalid.',
    });
  },
};
