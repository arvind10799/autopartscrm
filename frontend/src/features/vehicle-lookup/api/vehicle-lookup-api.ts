'use client';

import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import { vehicleLookupResponseSchema } from '@/features/vehicle-lookup/schemas/vehicle-lookup.schema';
import type { VehicleLookupResponse } from '@/features/vehicle-lookup/types/vehicle-lookup.types';
import { axiosBrowser } from '@/lib/api/axios-browser';
import { parseApiData } from '@/lib/api/parse-api-data';

export const vehicleLookupApi = {
  async getYears(): Promise<VehicleLookupResponse> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/vehicle-lookup/years',
    );

    return parseApiData(response, vehicleLookupResponseSchema, {
      emptyMessage: response.data.message || 'Vehicle years response was empty.',
      invalidMessage: 'Vehicle years payload was invalid.',
    });
  },

  async getMakes(search?: string): Promise<VehicleLookupResponse> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/vehicle-lookup/makes',
      {
        params: search ? { search } : undefined,
      },
    );

    return parseApiData(response, vehicleLookupResponseSchema, {
      emptyMessage: response.data.message || 'Vehicle makes response was empty.',
      invalidMessage: 'Vehicle makes payload was invalid.',
    });
  },

  async getModels(params: {
    make: string;
    year?: string;
    search?: string;
  }): Promise<VehicleLookupResponse> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/vehicle-lookup/models',
      {
        params: {
          make: params.make,
          year: params.year || undefined,
          search: params.search || undefined,
        },
      },
    );

    return parseApiData(response, vehicleLookupResponseSchema, {
      emptyMessage: response.data.message || 'Vehicle models response was empty.',
      invalidMessage: 'Vehicle models payload was invalid.',
    });
  },

  async getParts(search?: string): Promise<VehicleLookupResponse> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/vehicle-lookup/parts',
      {
        params: search ? { search } : undefined,
      },
    );

    return parseApiData(response, vehicleLookupResponseSchema, {
      emptyMessage: response.data.message || 'Vehicle parts response was empty.',
      invalidMessage: 'Vehicle parts payload was invalid.',
    });
  },
};
