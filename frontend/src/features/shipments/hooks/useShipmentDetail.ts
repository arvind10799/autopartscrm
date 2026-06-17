'use client';

import { useEffect, useState } from 'react';
import { useRequestTracker } from '@/lib/hooks/useRequestTracker';
import { toast } from '@/lib/stores/toast.store';
import { getErrorMessage } from '@/lib/utils/error';
import { shipmentsApi } from '../api/shipments-api';
import {
  applyOptimisticShipmentStatus,
  getAllowedNextShipmentStatuses,
  isValidShipmentId,
  isShipmentStatusTransitionAllowed,
  mergeShipmentSummaryIntoDetail,
} from '../lib/shipments.helpers';
import type {
  ShipmentDetail,
  ShipmentStatus,
} from '../types/shipment.types';

type UseShipmentDetailResult = {
  shipment: ShipmentDetail | null;
  isLoading: boolean;
  error: string | null;
  isUpdatingStatus: boolean;
  statusError: string | null;
  clearStatusError: () => void;
  updateStatus: (status: ShipmentStatus, proNumber?: string) => Promise<void>;
};

export function useShipmentDetail(shipmentId: string): UseShipmentDetailResult {
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const detailRequestTracker = useRequestTracker();
  const statusRequestTracker = useRequestTracker();

  useEffect(() => {
    const requestId = detailRequestTracker.beginRequest();
    const normalizedShipmentId = shipmentId.trim();

    const loadShipment = async () => {
      if (!normalizedShipmentId || !isValidShipmentId(normalizedShipmentId)) {
        setShipment(null);
        setError('Shipment identifier is invalid.');
        setStatusError(null);
        setIsUpdatingStatus(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setStatusError(null);

      try {
        const response = await shipmentsApi.getById(normalizedShipmentId);

        if (!detailRequestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setShipment(response);
      } catch (error) {
        if (!detailRequestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setShipment(null);

        setError(getErrorMessage(error, 'Unable to load this shipment right now.'));
      } finally {
        if (detailRequestTracker.isCurrentRequest(requestId)) {
          setIsLoading(false);
        }
      }
    };

    void loadShipment();
  }, [detailRequestTracker, shipmentId]);

  const clearStatusError = () => {
    setStatusError(null);
  };

  const updateStatus = async (nextStatus: ShipmentStatus, proNumber?: string) => {
    if (!shipment || isUpdatingStatus) {
      return;
    }

    const previousShipment = shipment;
    const nextAllowedStatuses = getAllowedNextShipmentStatuses(
      previousShipment.currentStatus,
    );

    if (!nextAllowedStatuses.includes(nextStatus)) {
      setStatusError(
        `Shipment status cannot transition from ${previousShipment.currentStatus} to ${nextStatus}.`,
      );
      return;
    }

    if (!isShipmentStatusTransitionAllowed(previousShipment, nextStatus)) {
      setStatusError('Shipment cannot be marked as delivered before it has shipped.');
      return;
    }

    const normalizedProNumber = proNumber?.trim();

    if (
      nextStatus === 'IN_TRANSIT' &&
      !previousShipment.proNumber &&
      !normalizedProNumber
    ) {
      setStatusError('PRO number is required when moving shipment to in transit.');
      return;
    }

    const requestId = statusRequestTracker.beginRequest();
    setStatusError(null);
    setIsUpdatingStatus(true);
    setShipment(
      applyOptimisticShipmentStatus(
        previousShipment,
        nextStatus,
        normalizedProNumber,
      ),
    );

    try {
      const updatedShipment = await shipmentsApi.updateStatus(previousShipment.id, {
        status: nextStatus,
        proNumber: normalizedProNumber,
      });

      if (!statusRequestTracker.isCurrentRequest(requestId)) {
        return;
      }

      setShipment((currentShipment) =>
        currentShipment
          ? mergeShipmentSummaryIntoDetail(currentShipment, updatedShipment)
          : currentShipment,
      );
      toast.success(
        'Shipment status updated',
        `Shipment ${previousShipment.bolNumber} is now ${nextStatus.toLowerCase()}.`,
      );
    } catch (error) {
      if (!statusRequestTracker.isCurrentRequest(requestId)) {
        return;
      }

      setShipment(previousShipment);
      const message = getErrorMessage(
        error,
        'Unable to update shipment status right now.',
      );
      setStatusError(message);
      toast.error('Shipment status update failed', message);
    } finally {
      if (statusRequestTracker.isCurrentRequest(requestId)) {
        setIsUpdatingStatus(false);
      }
    }
  };

  return {
    shipment,
    isLoading,
    error,
    isUpdatingStatus,
    statusError,
    clearStatusError,
    updateStatus,
  };
}
