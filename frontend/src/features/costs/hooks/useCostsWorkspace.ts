'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { UserRole } from '@/features/auth/types/auth.types';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { shipmentsApi } from '@/features/shipments/api/shipments-api';
import type { ShipmentSummary } from '@/features/shipments/types/shipment.types';
import { HttpError } from '@/lib/api/http-error';
import { useRequestTracker } from '@/lib/hooks/useRequestTracker';
import { toast } from '@/lib/stores/toast.store';
import { getErrorMessage } from '@/lib/utils/error';
import { costsApi } from '../api/costs-api';
import {
  buildDefaultShipmentCostFormValues,
  calculateGrossProfit,
  calculateTotalCosts,
  hydrateShipmentCostFormValues,
  isCostEditorRole,
  parseAmountInput,
  parseCurrencyInput,
} from '../lib/costs.helpers';
import {
  shipmentCostFormSchema,
  type ShipmentCostFormValues,
} from '../schemas/cost.schema';
import type {
  ShipmentCostDraft,
  ShipmentCostRecord,
} from '../types/cost.types';

const SHIPMENTS_FETCH_LIMIT = 100;

type UseCostsWorkspaceResult = {
  form: ReturnType<typeof useForm<ShipmentCostFormValues>>;
  role: UserRole | null;
  canEditCosts: boolean;
  shipments: ShipmentSummary[];
  selectedShipmentId: string;
  selectedShipment: ShipmentSummary | null;
  existingCost: ShipmentCostRecord | null;
  currentDraft: ShipmentCostDraft;
  isShipmentsLoading: boolean;
  shipmentsError: string | null;
  isContextLoading: boolean;
  contextError: string | null;
  formError: string | null;
  mode: 'create' | 'update';
  isDelivered: boolean;
  activeCurrency: string;
  totalCosts: number;
  liveGrossProfit: number | null;
  retryShipments: () => void;
  retryContext: () => void;
  handleShipmentChange: (shipmentId: string) => void;
  handleSubmit: ReturnType<
    ReturnType<typeof useForm<ShipmentCostFormValues>>['handleSubmit']
  >;
};

export function useCostsWorkspace(): UseCostsWorkspaceResult {
  const user = useAuthStore((state) => state.user);
  const role = user?.role ?? null;
  const canEditCosts = isCostEditorRole(role);
  const form = useForm<ShipmentCostFormValues>({
    resolver: zodResolver(shipmentCostFormSchema),
    defaultValues: buildDefaultShipmentCostFormValues(),
  });
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [existingCost, setExistingCost] = useState<ShipmentCostRecord | null>(
    null,
  );
  const [isShipmentsLoading, setIsShipmentsLoading] = useState(true);
  const [shipmentsError, setShipmentsError] = useState<string | null>(null);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [contextRefreshKey, setContextRefreshKey] = useState(0);
  const shipmentsRequestTracker = useRequestTracker();
  const contextRequestTracker = useRequestTracker();
  const [
    selectedShipmentId,
    purchaseAmountValue,
    shippingChargesValue,
    additionalChargesValue,
    currencyValue,
  ] = useWatch({
    control: form.control,
    name: [
      'shipmentId',
      'purchaseAmount',
      'shippingCharges',
      'additionalCharges',
      'currency',
    ],
  });
  const normalizedSelectedShipmentId = selectedShipmentId ?? '';

  const selectedShipment = useMemo(
    () =>
      shipments.find((shipment) => shipment.id === normalizedSelectedShipmentId) ??
      null,
    [normalizedSelectedShipmentId, shipments],
  );

  const currentDraft = useMemo(
    () => ({
      purchaseAmount: parseAmountInput(purchaseAmountValue),
      shippingCharges: parseAmountInput(shippingChargesValue),
      additionalCharges: parseAmountInput(additionalChargesValue),
    }),
    [additionalChargesValue, purchaseAmountValue, shippingChargesValue],
  );

  const activeCurrency = parseCurrencyInput(currencyValue);
  const totalCosts = calculateTotalCosts(currentDraft);
  const liveGrossProfit = calculateGrossProfit(
    selectedShipment?.order.totalSaleAmount ?? null,
    currentDraft,
  );
  const mode = existingCost ? 'update' : 'create';
  const isDelivered = selectedShipment?.currentStatus === 'DELIVERED';

  useEffect(() => {
    const requestId = shipmentsRequestTracker.beginRequest();

    const loadShipments = async () => {
      setIsShipmentsLoading(true);
      setShipmentsError(null);

      try {
        const response = await shipmentsApi.list({
          page: 1,
          limit: SHIPMENTS_FETCH_LIMIT,
        });

        if (!shipmentsRequestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setShipments(response.items);

        const currentSelectedShipmentId = form.getValues('shipmentId');
        const nextSelectedShipmentId =
          response.items.find((shipment) => shipment.id === currentSelectedShipmentId)
            ?.id ??
          response.items[0]?.id ??
          '';

        if (nextSelectedShipmentId) {
          form.setValue('shipmentId', nextSelectedShipmentId, {
            shouldDirty: false,
            shouldValidate: false,
          });
        } else {
          form.reset(buildDefaultShipmentCostFormValues());
        }
      } catch (error) {
        if (!shipmentsRequestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setShipments([]);
        setExistingCost(null);
        setShipmentsError(
          getErrorMessage(error, 'Unable to load shipments for the costs workspace.'),
        );
        setContextError(null);
        setFormError(null);
        form.reset(buildDefaultShipmentCostFormValues());
      } finally {
        if (shipmentsRequestTracker.isCurrentRequest(requestId)) {
          setIsShipmentsLoading(false);
        }
      }
    };

    void loadShipments();
  }, [form, refreshKey, shipmentsRequestTracker]);

  useEffect(() => {
    if (!normalizedSelectedShipmentId || !selectedShipment) {
      setExistingCost(null);
      setContextError(null);
      setFormError(null);
      setIsContextLoading(false);
      return;
    }

    const requestId = contextRequestTracker.beginRequest();

    const loadShipmentContext = async () => {
      setIsContextLoading(true);
      setContextError(null);
      setFormError(null);

      try {
        const cost = await costsApi.getByShipmentId(selectedShipment.id).catch(
          (error) => {
            if (error instanceof HttpError && error.status === 404) {
              return null;
            }

            throw error;
          },
        );

        if (!contextRequestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setExistingCost(cost);
        form.reset(
          cost
            ? hydrateShipmentCostFormValues(cost)
            : buildDefaultShipmentCostFormValues(selectedShipment.id),
        );
      } catch (error) {
        if (!contextRequestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setExistingCost(null);
        setContextError(
          getErrorMessage(
            error,
            'Unable to load the selected shipment cost context.',
          ),
        );
        form.reset(buildDefaultShipmentCostFormValues(selectedShipment.id));
      } finally {
        if (contextRequestTracker.isCurrentRequest(requestId)) {
          setIsContextLoading(false);
        }
      }
    };

    void loadShipmentContext();
  }, [
    contextRefreshKey,
    contextRequestTracker,
    form,
    normalizedSelectedShipmentId,
    selectedShipment,
  ]);

  const retryShipments = () => {
    setRefreshKey((currentValue) => currentValue + 1);
  };

  const retryContext = () => {
    setContextRefreshKey((currentValue) => currentValue + 1);
  };

  const handleShipmentChange = (shipmentId: string) => {
    setFormError(null);
    form.setValue('shipmentId', shipmentId, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleSubmit = form.handleSubmit(async (formValues) => {
    setFormError(null);

    try {
      // zodResolver with .pipe() may pass strings or already-transformed numbers
      // depending on form state. Explicitly convert to ensure valid numbers.
      const purchaseAmount = parseAmountInput(String(formValues.purchaseAmount));
      const shippingCharges = parseAmountInput(String(formValues.shippingCharges));
      const additionalCharges = parseAmountInput(String(formValues.additionalCharges));
      const currency = parseCurrencyInput(String(formValues.currency));

      const isUpdatingExistingCost = existingCost !== null;
      const savedCost = existingCost
        ? await costsApi.updateByShipmentId(formValues.shipmentId, {
            purchaseAmount,
            shippingCharges,
            additionalCharges,
            currency,
          })
        : await costsApi.create({
            shipmentId: formValues.shipmentId,
            purchaseAmount,
            shippingCharges,
            additionalCharges,
            currency,
          });

      setExistingCost(savedCost);
      setContextError(null);
      form.reset(hydrateShipmentCostFormValues(savedCost));
      toast.success(
        isUpdatingExistingCost
          ? 'Shipment cost updated successfully'
          : 'Shipment cost created successfully',
        'The latest cost data has been synced with this shipment.',
      );
    } catch (error) {
      setFormError(
        getErrorMessage(
          error,
          'Unable to save the shipment cost right now. Please try again.',
        ),
      );
    }
  });

  return {
    form,
    role,
    canEditCosts,
    shipments,
    selectedShipmentId: normalizedSelectedShipmentId,
    selectedShipment,
    existingCost,
    currentDraft,
    isShipmentsLoading,
    shipmentsError,
    isContextLoading,
    contextError,
    formError,
    mode,
    isDelivered: Boolean(isDelivered),
    activeCurrency,
    totalCosts,
    liveGrossProfit,
    retryShipments,
    retryContext,
    handleShipmentChange,
    handleSubmit,
  };
}
