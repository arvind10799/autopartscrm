import { Role } from '../../common/enums/role.enum';
import {
  assertReminderAccess,
  ReminderAccess,
  ReminderAction,
} from './reminder-policy';

const sales = {
  userId: 'sales',
  role: Role.SALES,
  name: 'Sales',
  email: 's@example.test',
};
const shipping = { ...sales, userId: 'shipping', role: Role.SHIPPING };
const admin = { ...sales, userId: 'admin', role: Role.ADMIN };
const own: ReminderAccess = {
  context: 'LEAD',
  ownerKind: 'USER',
  ownerUserId: 'sales',
  createdById: 'sales',
  assignedByAdmin: false,
  isHandoff: false,
};
const queue: ReminderAccess = {
  ...own,
  context: 'SHIPMENT_ORDER',
  ownerKind: 'SHIPPING_QUEUE',
  ownerUserId: null,
  createdById: 'shipping',
};
describe('reminder permissions', () => {
  it.each(['read', 'edit', 'complete', 'snooze', 'delete'] as ReminderAction[])(
    'allows an owner to %s their own lead reminder',
    (action) =>
      expect(() =>
        assertReminderAccess(sales, own, action, 'sales'),
      ).not.toThrow(),
  );
  it('denies other agents and the former website inquiry assignee', () => {
    expect(() =>
      assertReminderAccess({ ...sales, userId: 'other' }, own, 'read', 'sales'),
    ).toThrow();
    expect(() =>
      assertReminderAccess(
        sales,
        { ...own, context: 'WEBSITE_LEAD' },
        'read',
        'new-agent',
      ),
    ).toThrow();
  });
  it('allows completion of an Admin assignment but forbids Sales editing/deleting it', () => {
    const assigned = { ...own, createdById: 'admin', assignedByAdmin: true };
    expect(() =>
      assertReminderAccess(sales, assigned, 'complete', 'sales'),
    ).not.toThrow();
    expect(() =>
      assertReminderAccess(sales, assigned, 'edit', 'sales'),
    ).toThrow();
    expect(() =>
      assertReminderAccess(sales, assigned, 'delete', 'sales'),
    ).toThrow();
  });
  it('shares queue work and editing, but limits deletion to the creator', () => {
    const otherShipping = { ...shipping, userId: 'other' };
    for (const action of [
      'read',
      'edit',
      'complete',
      'snooze',
      'work',
    ] as ReminderAction[])
      expect(() =>
        assertReminderAccess(otherShipping, queue, action),
      ).not.toThrow();
    expect(() =>
      assertReminderAccess(otherShipping, queue, 'delete'),
    ).toThrow();
    expect(() => assertReminderAccess(shipping, queue, 'delete')).not.toThrow();
    expect(() =>
      assertReminderAccess(
        shipping,
        { ...queue, assignedByAdmin: true },
        'delete',
      ),
    ).toThrow();
  });
  it('does not let Shipping see Sales reminders or another user personal task', () => {
    expect(() =>
      assertReminderAccess(shipping, own, 'read', 'sales'),
    ).toThrow();
    expect(() =>
      assertReminderAccess(shipping, { ...own, context: 'PERSONAL' }, 'read'),
    ).toThrow();
    expect(() =>
      assertReminderAccess(
        shipping,
        { ...queue, ownerKind: 'USER', ownerUserId: 'admin' },
        'read',
      ),
    ).toThrow();
  });
  it('allows a handoff sender to track status, not complete the receiver task', () => {
    const handoff = { ...queue, createdById: 'sales', isHandoff: true };
    expect(() =>
      assertReminderAccess(sales, handoff, 'read', 'sales'),
    ).not.toThrow();
    expect(() =>
      assertReminderAccess(sales, handoff, 'complete', 'sales'),
    ).toThrow();
    expect(() =>
      assertReminderAccess(sales, handoff, 'read', 'other'),
    ).toThrow();
  });
  it('keeps personal tasks with their creator and limits markers to queue tasks', () => {
    const personal = { ...own, context: 'PERSONAL' as const };
    expect(() =>
      assertReminderAccess(sales, personal, 'complete'),
    ).not.toThrow();
    expect(() => assertReminderAccess(sales, personal, 'work')).toThrow();
  });
  it('allows Admin to manage any reminder', () => {
    for (const action of [
      'read',
      'edit',
      'complete',
      'snooze',
      'delete',
      'work',
    ] as ReminderAction[])
      expect(() => assertReminderAccess(admin, queue, action)).not.toThrow();
  });
});
