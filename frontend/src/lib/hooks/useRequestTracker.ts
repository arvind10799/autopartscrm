'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

export function useRequestTracker() {
  const requestSequenceRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const beginRequest = useCallback(() => {
    requestSequenceRef.current += 1;
    return requestSequenceRef.current;
  }, []);

  const isCurrentRequest = useCallback(
    (requestId: number) =>
      isMountedRef.current && requestId === requestSequenceRef.current,
    [],
  );

  return useMemo(
    () => ({
      beginRequest,
      isCurrentRequest,
    }),
    [beginRequest, isCurrentRequest],
  );
}
