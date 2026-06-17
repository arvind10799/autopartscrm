'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useForm, useWatch } from 'react-hook-form';
import { useAuthStore } from '@/features/auth/store/auth.store';
import type { TimestampRangeQuery } from '@/lib/filters/date-range';
import { ordersApi } from '@/features/orders/api/orders-api';
import {
  createEmptyOrdersResponse,
  ORDER_PAGE_SIZE,
} from '@/features/orders/lib/orders.helpers';
import type { OrderSummary } from '@/features/orders/types/order.types';
import { shipmentsApi } from '@/features/shipments/api/shipments-api';
import {
  createEmptyShipmentsResponse,
  SHIPMENT_PAGE_SIZE,
} from '@/features/shipments/lib/shipments.helpers';
import type { ShipmentSummary } from '@/features/shipments/types/shipment.types';
import { useRequestTracker } from '@/lib/hooks/useRequestTracker';
import { toast } from '@/lib/stores/toast.store';
import { getErrorMessage } from '@/lib/utils/error';
import { notesApi } from '../api/notes-api';
import {
  buildDefaultNoteFormValues,
  buildOrderNoteEntityContext,
  buildOrderNoteEntityOption,
  buildShipmentNoteEntityContext,
  buildShipmentNoteEntityOption,
  canBrowseOrderNotes,
  canBrowseShipmentNotes,
  getAvailableNoteEntityTypes,
  resolveNextNoteEntityId,
} from '../lib/notes.helpers';
import { noteFormSchema, type NoteFormValues } from '../schemas/note.schema';
import type {
  NoteEntityContext,
  NoteEntityOption,
  NoteEntityType,
  NoteRecord,
} from '../types/note.types';

const ENTITY_FETCH_LIMIT = Math.max(ORDER_PAGE_SIZE, SHIPMENT_PAGE_SIZE, 100);

type UseNotesWorkspaceResult = {
  form: UseFormReturn<NoteFormValues>;
  availableEntityTypes: NoteEntityType[];
  selectedEntityType: NoteEntityType;
  selectedEntityId: string;
  selectableEntities: NoteEntityOption[];
  selectedEntityContext: NoteEntityContext | null;
  notes: NoteRecord[];
  isEntitiesLoading: boolean;
  entitiesError: string | null;
  isNotesLoading: boolean;
  isNotesRefreshing: boolean;
  notesError: string | null;
  formError: string | null;
  retryEntities: () => void;
  retryNotes: () => void;
  handleEntityTypeChange: (entityType: NoteEntityType) => void;
  handleEntityIdChange: (entityId: string) => void;
  handleSubmit: ReturnType<UseFormReturn<NoteFormValues>['handleSubmit']>;
};

export function useNotesWorkspace(
  dateRangeQuery: TimestampRangeQuery = {},
): UseNotesWorkspaceResult {
  const authInitialized = useAuthStore((state) => state.initialized);
  const role = useAuthStore((state) => state.user?.role ?? null);
  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: buildDefaultNoteFormValues(),
  });
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [isEntitiesLoading, setIsEntitiesLoading] = useState(true);
  const [entitiesError, setEntitiesError] = useState<string | null>(null);
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [isNotesRefreshing, setIsNotesRefreshing] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [entitiesRefreshKey, setEntitiesRefreshKey] = useState(0);
  const [notesRefreshKey, setNotesRefreshKey] = useState(0);
  const notesRef = useRef<NoteRecord[]>([]);
  const previousSelectionKeyRef = useRef<string | null>(null);
  const entitiesRequestTracker = useRequestTracker();
  const notesRequestTracker = useRequestTracker();
  const [entityTypeValue, entityIdValue] = useWatch({
    control: form.control,
    name: ['entityType', 'entityId'],
  });
  const availableEntityTypes = useMemo(
    () => (authInitialized ? getAvailableNoteEntityTypes(role) : []),
    [authInitialized, role],
  );
  const fallbackEntityType = availableEntityTypes[0] ?? 'SHIPMENT';
  const selectedEntityType = availableEntityTypes.includes(entityTypeValue)
    ? entityTypeValue
    : fallbackEntityType;
  const selectedEntityId = entityIdValue?.trim() ?? '';
  const selectableEntities = useMemo(
    () =>
      selectedEntityType === 'ORDER'
        ? orders.map(buildOrderNoteEntityOption)
        : shipments.map(buildShipmentNoteEntityOption),
    [orders, selectedEntityType, shipments],
  );
  const selectedOrder =
    selectedEntityType === 'ORDER'
      ? orders.find((order) => order.id === selectedEntityId) ?? null
      : null;
  const selectedShipment =
    selectedEntityType === 'SHIPMENT'
      ? shipments.find((shipment) => shipment.id === selectedEntityId) ?? null
      : null;
  const selectedEntityContext = useMemo(
    () =>
      selectedEntityType === 'ORDER'
        ? buildOrderNoteEntityContext(selectedOrder)
        : buildShipmentNoteEntityContext(selectedShipment),
    [selectedEntityType, selectedOrder, selectedShipment],
  );

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    if (!authInitialized) {
      setIsEntitiesLoading(true);
      return;
    }

    const requestId = entitiesRequestTracker.beginRequest();

    const loadEntities = async () => {
      setIsEntitiesLoading(true);
      setEntitiesError(null);

      try {
        const shouldLoadOrders = canBrowseOrderNotes(role);
        const shouldLoadShipments = canBrowseShipmentNotes(role);
        const [ordersResponse, shipmentsResponse] = await Promise.all([
          shouldLoadOrders
            ? ordersApi.list({
                page: 1,
                limit: ENTITY_FETCH_LIMIT,
              })
            : Promise.resolve(createEmptyOrdersResponse(1, ENTITY_FETCH_LIMIT)),
          shouldLoadShipments
            ? shipmentsApi.list({
                page: 1,
                limit: ENTITY_FETCH_LIMIT,
              })
            : Promise.resolve(
                createEmptyShipmentsResponse(1, ENTITY_FETCH_LIMIT),
              ),
        ]);

        if (!entitiesRequestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setOrders(ordersResponse.items);
        setShipments(shipmentsResponse.items);

        const nextEntityTypes = getAvailableNoteEntityTypes(role);
        const currentMessage = form.getValues('message');
        const currentEntityType = form.getValues('entityType');
        const currentEntityId = form.getValues('entityId');
        const nextEntityType = nextEntityTypes.includes(currentEntityType)
          ? currentEntityType
          : (nextEntityTypes[0] ?? 'SHIPMENT');
        const nextEntityId = resolveNextNoteEntityId(
          nextEntityType,
          currentEntityId,
          ordersResponse.items,
          shipmentsResponse.items,
        );

        form.reset({
          message: currentMessage,
          entityType: nextEntityType,
          entityId: nextEntityId,
        });
      } catch (error) {
        if (!entitiesRequestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setOrders([]);
        setShipments([]);
        setNotes([]);
        setEntitiesError(
          getErrorMessage(error, 'Unable to load entities for the notes workspace.'),
        );
        setFormError(null);
        setNotesError(null);
      } finally {
        if (entitiesRequestTracker.isCurrentRequest(requestId)) {
          setIsEntitiesLoading(false);
        }
      }
    };

    void loadEntities();
  }, [
    authInitialized,
    entitiesRefreshKey,
    entitiesRequestTracker,
    form,
    role,
  ]);

  useEffect(() => {
    if (!authInitialized || availableEntityTypes.length === 0 || !selectedEntityId) {
      setNotes([]);
      setNotesError(null);
      setIsNotesLoading(false);
      setIsNotesRefreshing(false);
      previousSelectionKeyRef.current = null;
      return;
    }

    const requestId = notesRequestTracker.beginRequest();
    const selectionKey = `${selectedEntityType}:${selectedEntityId}`;
    const isSelectionChange = previousSelectionKeyRef.current !== selectionKey;
    previousSelectionKeyRef.current = selectionKey;

    const loadNotes = async () => {
      const hasVisibleNotes = notesRef.current.length > 0;
      const shouldUseBlockingLoader = isSelectionChange || !hasVisibleNotes;

      setIsNotesLoading(shouldUseBlockingLoader);
      setIsNotesRefreshing(!shouldUseBlockingLoader);
      setNotesError(null);

      if (isSelectionChange) {
        setNotes([]);
      }

      try {
        const notesResponse = await notesApi.listByEntity(
          selectedEntityType,
          selectedEntityId,
          dateRangeQuery,
        );

        if (!notesRequestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setNotes(notesResponse);
      } catch (error) {
        if (!notesRequestTracker.isCurrentRequest(requestId)) {
          return;
        }

        if (isSelectionChange || notesRef.current.length === 0) {
          setNotes([]);
        }

        setNotesError(
          getErrorMessage(error, 'Unable to load notes for the selected entity.'),
        );
      } finally {
        if (notesRequestTracker.isCurrentRequest(requestId)) {
          setIsNotesLoading(false);
          setIsNotesRefreshing(false);
        }
      }
    };

    void loadNotes();
  }, [
    authInitialized,
    availableEntityTypes.length,
    dateRangeQuery.createdFrom,
    dateRangeQuery.createdTo,
    notesRequestTracker,
    notesRefreshKey,
    selectedEntityId,
    selectedEntityType,
  ]);

  const retryEntities = () => {
    setEntitiesRefreshKey((currentValue) => currentValue + 1);
  };

  const retryNotes = () => {
    setFormError(null);
    setNotesError(null);
    setNotesRefreshKey((currentValue) => currentValue + 1);
  };

  const handleEntityTypeChange = (entityType: NoteEntityType) => {
    const nextEntityId = resolveNextNoteEntityId(
      entityType,
      '',
      orders,
      shipments,
    );

    clearTransientMessages();
    form.setValue('entityType', entityType, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('entityId', nextEntityId, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleEntityIdChange = (entityId: string) => {
    clearTransientMessages();
    form.setValue('entityId', entityId, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      const parsedValues = noteFormSchema.parse(values);
      const createdNote = await notesApi.create(parsedValues);

      setNotes((currentNotes) => [
        createdNote,
        ...currentNotes.filter((note) => note.id !== createdNote.id),
      ]);
      form.reset({
        message: '',
        entityType: parsedValues.entityType,
        entityId: parsedValues.entityId,
      });
      toast.success(
        'Note added successfully',
        'The activity feed is refreshing with the latest note.',
      );
      setNotesRefreshKey((currentValue) => currentValue + 1);
    } catch (error) {
      setFormError(
        getErrorMessage(
          error,
          'Unable to save the note right now. Please try again.',
        ),
      );
    }
  });

  return {
    form,
    availableEntityTypes,
    selectedEntityType,
    selectedEntityId,
    selectableEntities,
    selectedEntityContext:
      selectedEntityContext && selectedEntityId ? selectedEntityContext : null,
    notes,
    isEntitiesLoading,
    entitiesError,
    isNotesLoading,
    isNotesRefreshing,
    notesError,
    formError,
    retryEntities,
    retryNotes,
    handleEntityTypeChange,
    handleEntityIdChange,
    handleSubmit,
  };

  function clearTransientMessages() {
    setFormError(null);
    setNotesError(null);
  }
}
