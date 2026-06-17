import type { UserRole } from '@/features/auth/types/auth.types';

export const NOTE_ENTITY_TYPES = ['ORDER', 'SHIPMENT'] as const;

export type NoteEntityType = (typeof NOTE_ENTITY_TYPES)[number];

export interface NoteAuthor {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface NoteOrderReference {
  id: string;
  orderNumber: string;
  customerName: string;
}

export interface NoteShipmentReference {
  id: string;
  proNumber: string | null;
  orderId: string;
}

export interface BaseNoteRecord {
  id: string;
  message: string;
  entityType: NoteEntityType;
  entityId: string;
  createdAt: string;
  updatedAt: string;
  author: NoteAuthor;
}

export interface OrderNoteRecord extends BaseNoteRecord {
  entityType: 'ORDER';
  order: NoteOrderReference;
  shipment: null;
}

export interface ShipmentNoteRecord extends BaseNoteRecord {
  entityType: 'SHIPMENT';
  order: null;
  shipment: NoteShipmentReference;
}

export interface CreateNoteInput {
  message: string;
  entityType: NoteEntityType;
  entityId: string;
}

export type NoteRecord = OrderNoteRecord | ShipmentNoteRecord;

export interface NoteEntityOption {
  id: string;
  label: string;
  description: string;
}

export interface NoteEntityContext {
  title: string;
  subtitle: string;
  helperText: string;
}
