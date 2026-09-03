'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRequestTracker } from '@/lib/hooks/useRequestTracker';
import { getErrorMessage } from '@/lib/utils/error';
import { replacementsApi } from '../api/replacements-api';
import type {
  ReplacementRequest,
  UpdateReplacementInput,
} from '../types/replacement.types';

export function useReplacementDetail(replacementId: string) {
  const [replacement, setReplacement] = useState<ReplacementRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestTracker = useRequestTracker();

  useEffect(() => {
    const requestId = requestTracker.beginRequest();

    const loadReplacement = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await replacementsApi.getById(replacementId);

        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setReplacement(response);
      } catch (caughtError) {
        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setReplacement(null);
        setError(
          getErrorMessage(
            caughtError,
            'Unable to load replacement details right now.',
          ),
        );
      } finally {
        if (requestTracker.isCurrentRequest(requestId)) {
          setIsLoading(false);
        }
      }
    };

    void loadReplacement();
  }, [refreshKey, replacementId, requestTracker]);

  const updateReplacement = useCallback(
    async (payload: UpdateReplacementInput) => {
      setIsUpdating(true);
      setUpdateError(null);

      try {
        const response = await replacementsApi.update(replacementId, payload);
        setReplacement(response);
        return response;
      } catch (caughtError) {
        const message = getErrorMessage(
          caughtError,
          'Unable to update replacement right now.',
        );
        setUpdateError(message);
        throw caughtError;
      } finally {
        setIsUpdating(false);
      }
    },
    [replacementId],
  );

  return {
    replacement,
    isLoading,
    error,
    isUpdating,
    updateError,
    refreshReplacement: () => setRefreshKey((currentValue) => currentValue + 1),
    updateReplacement,
    clearUpdateError: () => setUpdateError(null),
  };
}
