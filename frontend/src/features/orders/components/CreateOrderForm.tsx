'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { vehicleLookupApi } from '@/features/vehicle-lookup/api/vehicle-lookup-api';
import type { VehicleLookupOption } from '@/features/vehicle-lookup/types/vehicle-lookup.types';
import { formatUsPhoneNumber } from '@/lib/forms/phone-format';
import { getPacificTodayDateInputValue } from '@/lib/utils/pacific-date';
import { cn } from '@/lib/utils/cn';
import { getErrorMessage } from '@/lib/utils/error';
import { ordersApi } from '../api/orders-api';
import { formatCurrency } from '../lib/order-formatters';
import {
  formatOrderPaymentMethodLabel,
  formatOrderStatusOptionLabel,
} from '../lib/orders.helpers';
import {
  createOrderFormSchema,
  type CreateOrderFormValues,
} from '../schemas/order.schema';
import {
  CREATE_ORDER_STATUSES,
  ORDER_CURRENCIES,
  ORDER_PAYMENT_METHODS,
} from '../types/order.types';
import type { OrderSummary } from '../types/order.types';

const defaultValues: CreateOrderFormValues = {
  leadId: undefined,
  advisorName: '',
  orderNumber: '',
  orderDate: '',
  customerName: '',
  partDescription: '',
  customerEmail: '',
  customerPhone: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  vehicleVariant: '',
  vehicleVin: '',
  vehicleNotes: '',
  vehicleConfiguration: '',
  billingAddress: '',
  billingPerson: '',
  billingPhone: '',
  shippingAddress: '',
  shippingPerson: '',
  shippingPhone: '',
  shippingAt: '',
  companyName: '',
  milesOffered: '',
  salePrice: '',
  basePrice: undefined,
  salesTax: 0,
  shippingCharges: 0,
  profit: 0,
  total: '',
  currency: 'USD',
  partialPayment: undefined,
  quantity: '1',
  status: 'CONFIRMED',
  paymentMethod: undefined,
  note: '',
};
const DEFAULT_CREATE_ORDER_STATUS = 'CONFIRMED' as const;

function getFirstFilledAmount(
  ...values: Array<CreateOrderFormValues['salePrice'] | undefined>
) {
  return values.find(
    (value) => value !== '' && value !== null && value !== undefined,
  );
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function buildCreateOrderFormValues(
  initialValues?: Partial<CreateOrderFormValues>,
): CreateOrderFormValues {
  const values = {
    ...defaultValues,
    ...initialValues,
    salesTax: 0,
    shippingCharges: 0,
    profit: 0,
  };
  const inferredTotal =
    getFirstFilledAmount(values.total, values.salePrice, values.basePrice) ??
    defaultValues.total;

  return {
    ...values,
    customerPhone: formatUsPhoneNumber(getStringValue(values.customerPhone)),
    vehicleVin: getStringValue(values.vehicleVin).toUpperCase().slice(0, 17),
    billingPhone: formatUsPhoneNumber(getStringValue(values.billingPhone)),
    shippingAddress: getStringValue(values.shippingAddress),
    shippingPhone: formatUsPhoneNumber(getStringValue(values.shippingPhone)),
    salePrice: getFirstFilledAmount(values.salePrice, inferredTotal) ?? '',
    total: getFirstFilledAmount(values.total, inferredTotal) ?? '',
    partialPayment:
      values.status === 'PARTIALLY_PAID' ? values.partialPayment : undefined,
    status: values.status ?? DEFAULT_CREATE_ORDER_STATUS,
  };
}

function formatCreateOrderStatusLabel(
  status: (typeof CREATE_ORDER_STATUSES)[number],
) {
  if (status === 'CONFIRMED') {
    return 'Paid';
  }

  return formatOrderStatusOptionLabel(status);
}

function getFieldErrorMessage(message: unknown): string {
  return typeof message === 'string' ? message : 'Invalid value.';
}

function parseAmount(value: unknown): number {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }

  const amount = Number(value);

  return Number.isFinite(amount) ? amount : 0;
}

function formatAmountInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildGeneratedPartDescription({
  vehicleYear,
  vehicleMake,
  vehicleModel,
  vehicleVariant,
  fallback,
}: {
  vehicleYear?: unknown;
  vehicleMake?: unknown;
  vehicleModel?: unknown;
  vehicleVariant?: unknown;
  fallback?: unknown;
}) {
  const vehicleDescription = [
    vehicleYear,
    vehicleMake,
    vehicleModel,
    vehicleVariant,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join(' ');

  const description =
    vehicleDescription ||
    (typeof fallback === 'string' && fallback.trim()
      ? fallback.trim()
      : 'Auto part');

  return description.slice(0, 255);
}

function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'space-y-3 rounded-[1.5rem] border border-border/70 bg-white/90 p-4 shadow-sm md:p-5',
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="font-[var(--font-heading)] text-base font-semibold tracking-[-0.02em] text-foreground">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function VehicleCombobox({
  id,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: {
  id: string;
  value: string;
  options: VehicleLookupOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedValue) {
      return options;
    }

    const startsWithMatches = options.filter((option) =>
      option.name.toLowerCase().startsWith(normalizedValue),
    );
    const containsMatches = options.filter((option) => {
      const optionName = option.name.toLowerCase();

      return (
        !optionName.startsWith(normalizedValue) &&
        optionName.includes(normalizedValue)
      );
    });

    return [...startsWithMatches, ...containsMatches];
  }, [normalizedValue, options]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className="h-11 rounded-xl pr-10"
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
        />
        <button
          type="button"
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setIsOpen((currentValue) => !currentValue)}
          aria-label={`Toggle ${id} options`}
        >
          <span className="text-xs">▼</span>
        </button>
      </div>

      {isOpen && !disabled ? (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-white py-1 text-sm shadow-xl">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={`${option.id}-${option.name}`}
                type="button"
                className="block w-full px-3 py-2 text-left text-foreground transition hover:bg-secondary"
                onClick={() => {
                  onChange(option.name);
                  setIsOpen(false);
                }}
              >
                {option.name}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-muted-foreground">
              No matching options. Manual input is allowed.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/80 px-3.5 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function CreateOrderForm({
  onCreated,
  initialValues,
}: {
  onCreated: (order: OrderSummary) => void;
  initialValues?: Partial<CreateOrderFormValues>;
}) {
  const authUser = useAuthStore((state) => state.user);
  const [formError, setFormError] = useState<string | null>(null);
  const [orderNumberError, setOrderNumberError] = useState<string | null>(null);
  const [isLoadingOrderNumber, setIsLoadingOrderNumber] = useState(true);
  const [yearOptions, setYearOptions] = useState<VehicleLookupOption[]>([]);
  const [makeOptions, setMakeOptions] = useState<VehicleLookupOption[]>([]);
  const [modelOptions, setModelOptions] = useState<VehicleLookupOption[]>([]);
  const [partOptions, setPartOptions] = useState<VehicleLookupOption[]>([]);
  const [isLoadingMakes, setIsLoadingMakes] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingParts, setIsLoadingParts] = useState(false);
  const [vehicleLookupNotice, setVehicleLookupNotice] = useState<string | null>(null);
  const resolvedInitialValues = buildCreateOrderFormValues(initialValues);
  const resolvedFormValues = {
    ...resolvedInitialValues,
    advisorName: authUser?.name ?? resolvedInitialValues.advisorName,
  };
  const maxOrderDate = useMemo(() => getPacificTodayDateInputValue(), []);
  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderFormSchema),
    defaultValues: resolvedFormValues,
  });
  const customerPhoneInput = form.register('customerPhone');
  const vehicleVinInput = form.register('vehicleVin');
  const billingPhoneInput = form.register('billingPhone');
  const shippingPhoneInput = form.register('shippingPhone');
  const handleCustomerPhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.target.value = formatUsPhoneNumber(event.target.value);
    void customerPhoneInput.onChange(event);
  };
  const handleVehicleVinChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.target.value = event.target.value.toUpperCase().slice(0, 17);
    void vehicleVinInput.onChange(event);
  };
  const handleBillingPhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.target.value = formatUsPhoneNumber(event.target.value);
    void billingPhoneInput.onChange(event);
  };
  const handleShippingPhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.target.value = formatUsPhoneNumber(event.target.value);
    void shippingPhoneInput.onChange(event);
  };
  const [
    status,
    total,
    partialPayment,
    currency,
    basePrice,
    salesTax,
    shippingCharges,
    profit,
    vehicleYear,
    vehicleMake,
    vehicleModel,
    vehicleVariant,
  ] = useWatch({
    control: form.control,
    name: [
      'status',
      'total',
      'partialPayment',
      'currency',
      'basePrice',
      'salesTax',
      'shippingCharges',
      'profit',
      'vehicleYear',
      'vehicleMake',
      'vehicleModel',
      'vehicleVariant',
    ],
  });

  const requiresPaymentMethod =
    (status ?? DEFAULT_CREATE_ORDER_STATUS) === 'PARTIALLY_PAID' ||
    (status ?? DEFAULT_CREATE_ORDER_STATUS) === 'CONFIRMED';
  const effectiveStatus = status ?? DEFAULT_CREATE_ORDER_STATUS;
  const isPaidStatus = effectiveStatus === 'CONFIRMED';
  const isPartiallyPaidStatus = effectiveStatus === 'PARTIALLY_PAID';
  const totalValue = Number(total || 0);
  const partialPaymentValue = Number(partialPayment || 0);
  const paidNowValue = isPaidStatus ? totalValue : partialPaymentValue;
  const remainingBalance = isPaidStatus
    ? 0
    : Math.max(totalValue - partialPaymentValue, 0);
  const selectedOrderCurrency = currency ?? 'USD';
  const selectedVehicleYear = typeof vehicleYear === 'string' ? vehicleYear : '';
  const selectedVehicleMake = typeof vehicleMake === 'string' ? vehicleMake : '';
  const selectedVehicleModel = typeof vehicleModel === 'string' ? vehicleModel : '';
  const selectedVehicleVariant =
    typeof vehicleVariant === 'string' ? vehicleVariant : '';

  useEffect(() => {
    if (authUser?.name) {
      form.setValue('advisorName', authUser.name, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [authUser?.name, form]);

  useEffect(() => {
    let isActive = true;

    vehicleLookupApi
      .getYears()
      .then((response) => {
        if (isActive) {
          setYearOptions(response.items);
        }
      })
      .catch(() => {
        if (isActive) {
          setVehicleLookupNotice(
            'Vehicle year options are unavailable. You can still type manually.',
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    setIsLoadingMakes(true);
    vehicleLookupApi
      .getMakes()
      .then((response) => {
        if (isActive) {
          setMakeOptions(response.items);
          setVehicleLookupNotice(null);
        }
      })
      .catch(() => {
        if (isActive) {
            setVehicleLookupNotice(
            'Vehicle make options are unavailable. You can still type manually.',
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingMakes(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    setIsLoadingParts(true);
    vehicleLookupApi
      .getParts()
      .then((response) => {
        if (isActive) {
          setPartOptions(response.items);
          setVehicleLookupNotice(null);
        }
      })
      .catch(() => {
        if (isActive) {
          setVehicleLookupNotice(
            'Vehicle part options are unavailable. You can still type manually.',
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingParts(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const make =
      typeof vehicleMake === 'string' && vehicleMake.trim().length > 0
        ? vehicleMake.trim()
        : '';
    const year =
      typeof vehicleYear === 'string' && vehicleYear.trim().length > 0
        ? vehicleYear.trim()
        : undefined;

    if (!make) {
      setModelOptions([]);
      return () => {
        isActive = false;
      };
    }

    setIsLoadingModels(true);
    vehicleLookupApi
      .getModels({ make, year })
      .then((response) => {
        if (isActive) {
          setModelOptions(response.items);
          setVehicleLookupNotice(null);
        }
      })
      .catch(() => {
        if (isActive) {
            setVehicleLookupNotice(
            'Vehicle model options are unavailable. You can still type manually.',
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingModels(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [vehicleMake, vehicleYear]);

  useEffect(() => {
    if (!status) {
      form.setValue('status', DEFAULT_CREATE_ORDER_STATUS, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [form, status]);

  useEffect(() => {
    let isActive = true;

    async function loadNextOrderNumber() {
      setIsLoadingOrderNumber(true);
      setOrderNumberError(null);

      try {
        const nextOrder = await ordersApi.getNextOrderNumber();

        if (!isActive) {
          return;
        }

        form.setValue('orderNumber', nextOrder.orderNumber, {
          shouldDirty: false,
          shouldValidate: true,
        });
      } catch {
        if (isActive) {
          setOrderNumberError('Unable to load the next order number.');
        }
      } finally {
        if (isActive) {
          setIsLoadingOrderNumber(false);
        }
      }
    }

    loadNextOrderNumber();

    return () => {
      isActive = false;
    };
  }, [form]);

  useEffect(() => {
    const calculatedTotal =
      parseAmount(basePrice) +
      parseAmount(salesTax) +
      parseAmount(shippingCharges) +
      parseAmount(profit);
    const nextTotal = calculatedTotal > 0 ? formatAmountInput(calculatedTotal) : '';

    form.setValue('total', nextTotal, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('salePrice', nextTotal, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [basePrice, form, profit, salesTax, shippingCharges]);

  useEffect(() => {
    if (!requiresPaymentMethod) {
      form.setValue('paymentMethod', undefined, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [form, requiresPaymentMethod]);

  useEffect(() => {
    if (isPaidStatus) {
      form.setValue('partialPayment', undefined, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, isPaidStatus]);

  useEffect(() => {
    form.setValue(
      'partDescription',
      buildGeneratedPartDescription({
        vehicleYear,
        vehicleMake,
        vehicleModel,
        vehicleVariant,
        fallback: resolvedInitialValues.partDescription,
      }),
      {
        shouldDirty: false,
        shouldValidate: true,
      },
    );
  }, [
    form,
    resolvedInitialValues.partDescription,
    vehicleMake,
    vehicleModel,
    vehicleVariant,
    vehicleYear,
  ]);

  useEffect(() => {
    form.reset(resolvedFormValues);
  }, [
    authUser?.name,
    form,
    resolvedInitialValues.basePrice,
    resolvedInitialValues.advisorName,
    resolvedInitialValues.billingAddress,
    resolvedInitialValues.billingPerson,
    resolvedInitialValues.billingPhone,
    resolvedInitialValues.companyName,
    resolvedInitialValues.customerEmail,
    resolvedInitialValues.customerName,
    resolvedInitialValues.customerPhone,
    resolvedInitialValues.leadId,
    resolvedInitialValues.milesOffered,
    resolvedInitialValues.note,
    resolvedInitialValues.orderDate,
    resolvedInitialValues.orderNumber,
    resolvedInitialValues.partDescription,
    resolvedInitialValues.partialPayment,
    resolvedInitialValues.paymentMethod,
    resolvedInitialValues.profit,
    resolvedInitialValues.quantity,
    resolvedInitialValues.salePrice,
    resolvedInitialValues.salesTax,
    resolvedInitialValues.shippingAddress,
    resolvedInitialValues.shippingAt,
    resolvedInitialValues.shippingCharges,
    resolvedInitialValues.shippingPerson,
    resolvedInitialValues.shippingPhone,
    resolvedInitialValues.status,
    resolvedInitialValues.total,
    resolvedInitialValues.vehicleConfiguration,
    resolvedInitialValues.vehicleMake,
    resolvedInitialValues.vehicleModel,
    resolvedInitialValues.vehicleNotes,
    resolvedInitialValues.vehicleVariant,
    resolvedInitialValues.vehicleVin,
    resolvedInitialValues.vehicleYear,
  ]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      const payload = createOrderFormSchema.parse({
        ...values,
        partDescription: buildGeneratedPartDescription({
          vehicleYear: values.vehicleYear,
          vehicleMake: values.vehicleMake,
          vehicleModel: values.vehicleModel,
          vehicleVariant: values.vehicleVariant,
          fallback: values.partDescription,
        }),
        status: values.status || DEFAULT_CREATE_ORDER_STATUS,
        partialPayment:
          (values.status || DEFAULT_CREATE_ORDER_STATUS) === 'PARTIALLY_PAID'
            ? values.partialPayment
            : undefined,
      });
      const createdOrder = await ordersApi.create(payload);

      onCreated(createdOrder);
      form.reset({
        ...buildCreateOrderFormValues(initialValues),
        advisorName: authUser?.name ?? '',
      });
    } catch (error) {
      setFormError(
        getErrorMessage(
          error,
          'Unable to create the order right now. Please try again.',
        ),
      );
    }
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <input type="hidden" {...form.register('leadId')} />
      <input type="hidden" {...form.register('quantity')} />
      <input type="hidden" {...form.register('salePrice')} />
      <input type="hidden" {...form.register('salesTax')} />
      <input type="hidden" {...form.register('shippingCharges')} />
      <input type="hidden" {...form.register('profit')} />
      <input type="hidden" {...form.register('total')} />
      <input type="hidden" {...form.register('partDescription')} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.95fr)]">
        <div className="space-y-4">
          <FormSection
            title="Order and customer"
            description="Front-load the information your team reaches for first."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field
                id="advisorName"
                label="Advisor name"
                error={form.formState.errors.advisorName?.message?.toString()}
              >
                <Input
                  id="advisorName"
                  readOnly
                  className="h-11 rounded-xl bg-secondary/30 text-foreground"
                  {...form.register('advisorName')}
                />
              </Field>

              <Field
                id="orderNumber"
                label="Order number"
                error={form.formState.errors.orderNumber?.message?.toString()}
                className="xl:col-span-2"
              >
                <Input
                  id="orderNumber"
                  placeholder={isLoadingOrderNumber ? 'Generating...' : 'MAPMMDDYYNN'}
                  className="h-11 rounded-xl"
                  readOnly
                  aria-busy={isLoadingOrderNumber}
                  {...form.register('orderNumber')}
                />
                {orderNumberError ? (
                  <p className="text-xs text-destructive">{orderNumberError}</p>
                ) : null}
              </Field>

              <Field
                id="orderDate"
                label="Order date"
                error={form.formState.errors.orderDate?.message?.toString()}
              >
                <Input
                  id="orderDate"
                  type="date"
                  max={maxOrderDate}
                  className="h-11 rounded-xl"
                  {...form.register('orderDate')}
                />
              </Field>

              <Field
                id="customerName"
                label="Customer name"
                error={form.formState.errors.customerName?.message?.toString()}
                className="xl:col-span-2"
              >
                <Input
                  id="customerName"
                  placeholder="Customer Name"
                  className="h-11 rounded-xl"
                  {...form.register('customerName')}
                />
              </Field>

              <Field
                id="customerPhone"
                label="Mobile"
                error={form.formState.errors.customerPhone?.message?.toString()}
              >
                <Input
                  id="customerPhone"
                  type="tel"
                  maxLength={14}
                  placeholder="(555) 555-1234"
                  className="h-11 rounded-xl"
                  {...customerPhoneInput}
                  onChange={handleCustomerPhoneChange}
                />
              </Field>

              <Field
                id="customerEmail"
                label="Email"
                error={form.formState.errors.customerEmail?.message?.toString()}
                className="md:col-span-2 xl:col-span-2"
              >
                <Input
                  id="customerEmail"
                  type="email"
                  placeholder="buyer@metroparts.com"
                  className="h-11 min-w-0 rounded-xl"
                  {...form.register('customerEmail')}
                />
              </Field>

            </div>
          </FormSection>

          <FormSection
            title="Vehicle and fitment"
            description="Keep the fitment picture tight without stretching the popup."
          >
            {vehicleLookupNotice ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                {vehicleLookupNotice}
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field
                id="vehicleYear"
                label="Year"
                error={form.formState.errors.vehicleYear?.message?.toString()}
              >
                <VehicleCombobox
                  id="vehicleYear"
                  value={selectedVehicleYear}
                  options={yearOptions}
                  placeholder="Select or type year"
                  onChange={(nextValue) => {
                    form.setValue('vehicleYear', nextValue, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    form.setValue('vehicleModel', '', {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                />
              </Field>

              <Field
                id="vehicleMake"
                label="Make"
                error={form.formState.errors.vehicleMake?.message?.toString()}
              >
                <VehicleCombobox
                  id="vehicleMake"
                  value={selectedVehicleMake}
                  options={makeOptions}
                  disabled={isLoadingMakes && makeOptions.length === 0}
                  placeholder={isLoadingMakes ? 'Loading makes...' : 'Select or type make'}
                  onChange={(nextValue) => {
                    form.setValue('vehicleMake', nextValue, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    form.setValue('vehicleModel', '', {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                />
              </Field>

              <Field
                id="vehicleModel"
                label="Model"
                error={form.formState.errors.vehicleModel?.message?.toString()}
              >
                <VehicleCombobox
                  id="vehicleModel"
                  value={selectedVehicleModel}
                  options={modelOptions}
                  disabled={!selectedVehicleMake || (isLoadingModels && modelOptions.length === 0)}
                  placeholder={
                    isLoadingModels
                      ? 'Loading models...'
                      : selectedVehicleMake
                        ? 'Select or type model'
                        : 'Select make first'
                  }
                  onChange={(nextValue) =>
                    form.setValue('vehicleModel', nextValue, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </Field>

              <Field
                id="vehicleVariant"
                label="Part"
                error={form.formState.errors.vehicleVariant?.message?.toString()}
              >
                <VehicleCombobox
                  id="vehicleVariant"
                  value={selectedVehicleVariant}
                  options={partOptions}
                  disabled={isLoadingParts && partOptions.length === 0}
                  placeholder={isLoadingParts ? 'Loading parts...' : 'Select or type part'}
                  onChange={(nextValue) =>
                    form.setValue('vehicleVariant', nextValue, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </Field>

              <Field
                id="vehicleVin"
                label="VIN"
                error={form.formState.errors.vehicleVin?.message?.toString()}
                className="xl:col-span-2"
              >
                <Input
                  id="vehicleVin"
                  maxLength={17}
                  className="h-11 rounded-xl"
                  {...vehicleVinInput}
                  onChange={handleVehicleVinChange}
                />
              </Field>

              <Field
                id="vehicleNotes"
                label="Part Description"
                error={form.formState.errors.vehicleNotes?.message?.toString()}
                className="xl:col-span-2"
              >
                <Textarea
                  id="vehicleNotes"
                  rows={3}
                  placeholder="Part description notes"
                  className="min-h-[92px] rounded-xl"
                  {...form.register('vehicleNotes')}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Addresses and fulfillment"
            description="Billing and shipping details stay side by side for faster review."
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-border/60 bg-secondary/20 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Billing
                </p>
                <div className="grid gap-3">
                  <Field
                    id="billingAddress"
                    label="Address"
                    error={form.formState.errors.billingAddress?.message?.toString()}
                  >
                    <Textarea
                      id="billingAddress"
                      rows={3}
                      className="min-h-[88px] rounded-xl"
                      {...form.register('billingAddress')}
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      id="billingPerson"
                      label="Person"
                      error={form.formState.errors.billingPerson?.message?.toString()}
                    >
                      <Input
                        id="billingPerson"
                        className="h-11 rounded-xl"
                        {...form.register('billingPerson')}
                      />
                    </Field>

                    <Field
                      id="billingPhone"
                      label="Phone"
                      error={form.formState.errors.billingPhone?.message?.toString()}
                    >
                      <Input
                        id="billingPhone"
                        type="tel"
                        maxLength={14}
                        className="h-11 rounded-xl"
                        {...billingPhoneInput}
                        onChange={handleBillingPhoneChange}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/60 bg-secondary/20 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Shipping
                </p>
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Address
                    </Label>
                    <div className="grid gap-3 rounded-2xl border border-border/60 bg-white/60 p-3">
                      <Field
                        id="shippingAddress"
                        label="Business address"
                        error={form.formState.errors.shippingAddress?.message?.toString()}
                      >
                        <Textarea
                          id="shippingAddress"
                          rows={3}
                          className="min-h-[88px] rounded-xl"
                          placeholder="Enter business address"
                          {...form.register('shippingAddress')}
                        />
                      </Field>

                      <Field
                        id="companyName"
                        label="Business name"
                        error={form.formState.errors.companyName?.message?.toString()}
                      >
                        <Input
                          id="companyName"
                          className="h-11 rounded-xl"
                          placeholder="Enter business name"
                          {...form.register('companyName')}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      id="shippingPerson"
                      label="Person"
                      error={form.formState.errors.shippingPerson?.message?.toString()}
                    >
                      <Input
                        id="shippingPerson"
                        className="h-11 rounded-xl"
                        {...form.register('shippingPerson')}
                      />
                    </Field>

                    <Field
                      id="shippingPhone"
                      label="Phone"
                      error={form.formState.errors.shippingPhone?.message?.toString()}
                    >
                      <Input
                        id="shippingPhone"
                        type="tel"
                        maxLength={14}
                        className="h-11 rounded-xl"
                        {...shippingPhoneInput}
                        onChange={handleShippingPhoneChange}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          </FormSection>
        </div>

        <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <FormSection
            title="Commercials"
            description="Status, payment, and costing stay grouped for quick decisions."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                id="status"
                label="Status"
                error={form.formState.errors.status?.message?.toString()}
              >
                <Select
                  id="status"
                  className="h-11 rounded-xl"
                  defaultValue={DEFAULT_CREATE_ORDER_STATUS}
                  {...form.register('status')}
                >
                  {CREATE_ORDER_STATUSES.map((nextStatus) => (
                    <option key={nextStatus} value={nextStatus}>
                      {formatCreateOrderStatusLabel(nextStatus)}
                    </option>
                  ))}
                </Select>
              </Field>

              {requiresPaymentMethod ? (
                <Field
                  id="paymentMethod"
                  label="Payment method"
                  error={form.formState.errors.paymentMethod?.message?.toString()}
                >
                  <Select
                    id="paymentMethod"
                    className="h-11 rounded-xl"
                    {...form.register('paymentMethod')}
                  >
                    <option value="">Select payment method</option>
                    {ORDER_PAYMENT_METHODS.map((paymentMethod) => (
                      <option key={paymentMethod} value={paymentMethod}>
                        {formatOrderPaymentMethodLabel(paymentMethod)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-3.5 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Payment method
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose a paid status to enable payment capture.
                  </p>
                </div>
              )}

              <Field
                id="milesOffered"
                label="Miles offered"
                error={form.formState.errors.milesOffered?.message?.toString()}
              >
                <Input
                  id="milesOffered"
                  className="h-11 rounded-xl"
                  {...form.register('milesOffered')}
                />
              </Field>

              <Field
                id="basePrice"
                label="Order amount"
                error={form.formState.errors.basePrice?.message?.toString()}
              >
                <div className="flex h-11 overflow-hidden rounded-xl border border-input bg-white shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <Select
                    id="currency"
                    aria-label="Order amount currency"
                    className="h-full w-24 rounded-none border-0 bg-secondary/50 px-3 text-sm font-semibold shadow-none focus-visible:ring-0"
                    {...form.register('currency')}
                  >
                    {ORDER_CURRENCIES.map((currencyOption) => (
                      <option key={currencyOption} value={currencyOption}>
                        {currencyOption}
                      </option>
                    ))}
                  </Select>
                  <Input
                    id="basePrice"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="h-full flex-1 rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    {...form.register('basePrice')}
                  />
                </div>
              </Field>

              {isPartiallyPaidStatus ? (
                <Field
                  id="partialPayment"
                  label="Partial payment"
                  error={form.formState.errors.partialPayment?.message?.toString()}
                >
                  <Input
                    id="partialPayment"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="h-11 rounded-xl"
                    {...form.register('partialPayment')}
                  />
                </Field>
              ) : null}
            </div>

            <div className="rounded-[1.35rem] border border-border/70 bg-secondary/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Payment snapshot
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label="Total"
                  value={formatCurrency(totalValue || 0, selectedOrderCurrency)}
                />
                <MetricCard
                  label="Paid now"
                  value={formatCurrency(paidNowValue || 0, selectedOrderCurrency)}
                />
                <MetricCard
                  label="Remaining amount"
                  value={formatCurrency(remainingBalance, selectedOrderCurrency)}
                />
              </div>
            </div>

            <Field
              id="note"
              label="Order note"
              error={form.formState.errors.note?.message?.toString()}
            >
              <Textarea
                id="note"
                rows={4}
                placeholder="Add a handoff note, customer update, or internal context for this order"
                className="min-h-[112px] rounded-xl"
                {...form.register('note')}
              />
            </Field>
          </FormSection>

          {formError ? (
            <div className="rounded-[1.35rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <div className="rounded-[1.5rem] border border-border/70 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Ready to create
                </p>
                <p className="text-sm text-muted-foreground">
                  Review the amounts and submit from here.
                </p>
              </div>
              <div className="rounded-2xl bg-primary/10 px-3 py-2 text-right text-primary">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                  Order total
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(totalValue || 0, selectedOrderCurrency)}
                </p>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-4 h-11 w-full rounded-xl"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Creating order...' : 'Create order'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
