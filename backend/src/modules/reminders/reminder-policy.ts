import { ForbiddenException } from '@nestjs/common';
import { ReminderContext, ReminderOwnerKind } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

export type ReminderAction =
  | 'read'
  | 'edit'
  | 'complete'
  | 'snooze'
  | 'delete'
  | 'work';
export const SHIPPING_CONTEXTS: readonly ReminderContext[] = [
  'SHIPMENT_ORDER',
  'SHIPMENT',
  'REPLACEMENT',
];
export interface ReminderAccess {
  context: ReminderContext;
  ownerKind: ReminderOwnerKind;
  ownerUserId: string | null;
  createdById: string;
  assignedByAdmin: boolean;
  isHandoff: boolean;
}

/** Sender tracking exposes task status, without receiver-only notes or outcome text. */
export function isReminderStatusOnly(
  user: AuthenticatedUser,
  reminder: ReminderAccess,
): boolean {
  if (user.role === Role.ADMIN) return false;
  if (user.role === Role.SALES && reminder.ownerKind === 'SHIPPING_QUEUE')
    return true;
  return (
    reminder.isHandoff &&
    reminder.createdById === user.userId &&
    reminder.ownerUserId !== user.userId &&
    !(user.role === Role.SHIPPING && reminder.ownerKind === 'SHIPPING_QUEUE')
  );
}

export function assertReminderAccess(
  user: AuthenticatedUser,
  reminder: ReminderAccess,
  action: ReminderAction,
  recordOwnerId?: string | null,
) {
  if (user.role === Role.ADMIN) return;
  if (
    action === 'read' &&
    user.role === Role.SALES &&
    reminder.ownerKind === 'SHIPPING_QUEUE' &&
    recordOwnerId === user.userId
  )
    return;
  const personal = reminder.context === 'PERSONAL';
  const owned =
    reminder.ownerKind === 'USER' && reminder.ownerUserId === user.userId;
  // Sender tracking is read-only. This does not grant access to the receiving workspace.
  if (
    action === 'read' &&
    reminder.isHandoff &&
    reminder.createdById === user.userId &&
    (user.role === Role.SHIPPING || recordOwnerId === user.userId)
  )
    return;
  const queueAccess =
    user.role === Role.SHIPPING &&
    reminder.ownerKind === 'SHIPPING_QUEUE' &&
    SHIPPING_CONTEXTS.includes(reminder.context);
  const salesAccess =
    user.role === Role.SALES &&
    owned &&
    !SHIPPING_CONTEXTS.includes(reminder.context) &&
    (personal || recordOwnerId === user.userId);
  const personalAccess =
    personal && owned && reminder.createdById === user.userId;
  if (!queueAccess && !salesAccess && !personalAccess)
    throw new ForbiddenException('You cannot access this reminder.');
  if (action === 'work' && !queueAccess)
    throw new ForbiddenException(
      'Working on it is available only for Shipping queue reminders.',
    );
  if (
    action === 'delete' &&
    (reminder.createdById !== user.userId || reminder.assignedByAdmin)
  )
    throw new ForbiddenException(
      'Only the creator can delete this reminder; Admin assignments cannot be deleted.',
    );
  if (
    action === 'edit' &&
    user.role === Role.SALES &&
    reminder.createdById !== user.userId
  )
    throw new ForbiddenException('You can edit only reminders you created.');
}
