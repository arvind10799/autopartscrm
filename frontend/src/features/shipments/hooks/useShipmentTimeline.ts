'use client';

import { useEffect, useState } from 'react';
import { useRequestTracker } from '@/lib/hooks/useRequestTracker';
import { getErrorMessage } from '@/lib/utils/error';
import { shipmentsApi } from '../api/shipments-api';
import { isValidShipmentId } from '../lib/shipments.helpers';
import type { ShipmentTimeline } from '../types/shipment.types';

type UseShipmentTimelineResult = {
  timeline: ShipmentTimeline | null;
  isLoading: boolean;
  error: string | null;
};

export function useShipmentTimeline(
  shipmentId: string,
): UseShipmentTimelineResult {
  const [timeline, setTimeline] = useState<ShipmentTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestTracker = useRequestTracker();

  useEffect(() => {
    const requestId = requestTracker.beginRequest();
    const normalizedShipmentId = shipmentId.trim();

    const loadTimeline = async () => {
      if (!normalizedShipmentId || !isValidShipmentId(normalizedShipmentId)) {
        setTimeline(null);
        setError('Shipment identifier is invalid.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await shipmentsApi.getTimeline(normalizedShipmentId);

        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setTimeline(response);
      } catch (error) {
        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setTimeline(null);

        setError(
          getErrorMessage(error, 'Unable to load tracking timeline right now.'),
        );
      } finally {
        if (requestTracker.isCurrentRequest(requestId)) {
          setIsLoading(false);
        }
      }
    };

    void loadTimeline();
  }, [requestTracker, shipmentId]);

  return {
    timeline,
    isLoading,
    error,
  };
}
