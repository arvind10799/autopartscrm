import type { UserRole } from '@/features/auth/types/auth.types';
import { formatOrderStatus } from '@/features/orders/lib/order-formatters';
import type { OrderSummary } from '@/features/orders/types/order.types';
import { formatShipmentStatus } from '@/features/shipments/lib/shipment-formatters';
import type { ShipmentSummary } from '@/features/shipments/types/shipment.types';
import type { NoteFormValues } from '../schemas/note.schema';
import type {
  CreateNoteInput,
  NoteEntityContext,
  NoteEntityOption,
  NoteEntityType,
  NoteRecord,
} from '../types/note.types';

const noteDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function buildDefaultNoteFormValues(
  entityType: NoteEntityType = 'ORDER',
  entityId = '',
): NoteFormValues {
  return {
    message: '',
    entityType,
    entityId,
  };
}

export function toBackendCreateNotePayload(payload: CreateNoteInput) {
  return {
    content: payload.message,
    entityType: payload.entityType,
    entityId: payload.entityId,
  };
}

export function getAvailableNoteEntityTypes(
  role: UserRole | null | undefined,
): NoteEntityType[] {
  switch (role) {
    case 'ADMIN':
    case 'SALES':
      return ['ORDER', 'SHIPMENT'];
    case 'SHIPPING':
      return ['SHIPMENT'];
    default:
      return [];
  }
}

export function canBrowseOrderNotes(
  role: UserRole | null | undefined,
): boolean {
  return role === 'ADMIN' || role === 'SALES';
}

export function canBrowseShipmentNotes(
  role: UserRole | null | undefined,
): boolean {
  return role === 'ADMIN' || role === 'SALES' || role === 'SHIPPING';
}

export function isNoteEntityType(value: string): value is NoteEntityType {
  return value === 'ORDER' || value === 'SHIPMENT';
}

export function parseNoteEntityType(value: string): NoteEntityType | null {
  const normalizedValue = value.trim().toUpperCase();

  return isNoteEntityType(normalizedValue) ? normalizedValue : null;
}

export function formatNoteEntityTypeLabel(entityType: NoteEntityType): string {
  return entityType === 'ORDER' ? 'Order' : 'Shipment';
}

export function buildOrderNoteEntityOption(order: OrderSummary): NoteEntityOption {
  return {
    id: order.id,
    label: order.orderNumber,
    description: `${order.customerName} | ${formatOrderStatus(order.status)}`,
  };
}

export function buildShipmentNoteEntityOption(
  shipment: ShipmentSummary,
): NoteEntityOption {
  return {
    id: shipment.id,
    label: shipment.proNumber ?? 'PRO pending',
    description: `${shipment.order.orderNumber} | ${formatShipmentStatus(
      shipment.currentStatus,
    )}`,
  };
}

export function buildOrderNoteEntityContext(
  order: OrderSummary | null,
): NoteEntityContext | null {
  if (!order) {
    return null;
  }

  return {
    title: order.orderNumber,
    subtitle: order.customerName,
    helperText: `Notes attached to the order record for ${order.customerName}. The list refreshes automatically after each save.`,
  };
}

export function buildShipmentNoteEntityContext(
  shipment: ShipmentSummary | null,
): NoteEntityContext | null {
  if (!shipment) {
    return null;
  }

  return {
    title: shipment.proNumber ?? 'PRO pending',
    subtitle: `${shipment.order.orderNumber} | ${shipment.order.customerName}`,
    helperText:
      'Notes attached to the shipment record and its logistics activity. The list refreshes automatically after each save.',
  };
}

export function resolveNextNoteEntityId(
  entityType: NoteEntityType,
  currentEntityId: string,
  orderOptions: OrderSummary[],
  shipmentOptions: ShipmentSummary[],
): string {
  if (entityType === 'ORDER') {
    return (
      orderOptions.find((order) => order.id === currentEntityId)?.id ??
      orderOptions[0]?.id ??
      ''
    );
  }

  return (
    shipmentOptions.find((shipment) => shipment.id === currentEntityId)?.id ??
    shipmentOptions[0]?.id ??
    ''
  );
}

export function formatNoteTimestamp(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unknown time';
  }

  return noteDateTimeFormatter.format(parsedDate);
}

export function getNoteEntityReference(note: NoteRecord) {
  if (note.entityType === 'ORDER') {
    return {
      title: note.order.orderNumber,
      description: note.order.customerName,
    };
  }

  return {
    title: note.shipment.proNumber ?? 'PRO pending',
    description: `Order ${note.shipment.orderId}`,
  };
}
