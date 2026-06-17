import { z } from 'zod';
import { USER_ROLES } from '@/features/auth/types/auth.types';
import { NOTE_ENTITY_TYPES } from '../types/note.types';

const noteEntityTypeSchema = z.enum(NOTE_ENTITY_TYPES);
const userRoleSchema = z.enum(USER_ROLES);
const noteIdSchema = z.string().uuid();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const noteMessageSchema = z
  .string()
  .trim()
  .min(1, 'Message is required.')
  .max(1000, 'Message must be 1000 characters or fewer.');

const noteAuthorSchema = z.object({
  id: noteIdSchema,
  name: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
});

const noteOrderReferenceSchema = z.object({
  id: noteIdSchema,
  orderNumber: z.string(),
  customerName: z.string(),
});

const noteShipmentReferenceSchema = z.object({
  id: noteIdSchema,
  proNumber: z.string().nullable(),
  orderId: noteIdSchema,
});

const noteBackendBaseSchema = z.object({
  id: noteIdSchema,
  content: z.string(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  author: noteAuthorSchema,
});

const orderNoteBackendSchema = noteBackendBaseSchema.extend({
  entityType: z.literal('ORDER'),
  order: noteOrderReferenceSchema,
  shipment: z.null(),
});

const shipmentNoteBackendSchema = noteBackendBaseSchema.extend({
  entityType: z.literal('SHIPMENT'),
  order: z.null(),
  shipment: noteShipmentReferenceSchema,
});

const noteBackendSchema = z.discriminatedUnion('entityType', [
  orderNoteBackendSchema,
  shipmentNoteBackendSchema,
]);

function normalizeNote(note: z.infer<typeof noteBackendSchema>) {
  if (note.entityType === 'ORDER') {
    return {
      id: note.id,
      message: note.content,
      entityType: note.entityType,
      entityId: note.order.id,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      author: note.author,
      order: note.order,
      shipment: note.shipment,
    };
  }

  return {
    id: note.id,
    message: note.content,
    entityType: note.entityType,
    entityId: note.shipment.id,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    author: note.author,
    order: note.order,
    shipment: note.shipment,
  };
}

export const noteSchema = noteBackendSchema.transform(normalizeNote);

export const notesListSchema = z
  .array(noteBackendSchema)
  .transform((notes) => notes.map(normalizeNote));

export const createNoteSchema = z.object({
  message: noteMessageSchema,
  entityType: noteEntityTypeSchema,
  entityId: noteIdSchema,
});

export const noteFormSchema = z
  .object({
    message: noteMessageSchema,
    entityType: noteEntityTypeSchema,
    entityId: z.string().trim().min(1, 'Select an entity.'),
  })
  .pipe(createNoteSchema);

export type NoteFormValues = z.input<typeof noteFormSchema>;
