import {
  taskDateShift,
  taskDayBounds,
  taskDayStart,
} from './task-workspace-time';
import { taskScope } from './task-workspace.service';
import { Role } from '../../common/enums/role.enum';
import { isReminderStatusOnly, type ReminderAccess } from './reminder-policy';
const user = {
  userId: 'test',
  name: 'Test',
  email: 'test@example.test',
  role: Role.SALES,
};
describe('task workspace boundaries', () => {
  const handoff: ReminderAccess = {
    context: 'ORDER',
    ownerKind: 'USER',
    ownerUserId: 'sales-recipient',
    createdById: 'shipping-sender',
    assignedByAdmin: false,
    isHandoff: true,
  };
  it('redacts Shipping sender tracking of a Sales handoff', () =>
    expect(
      isReminderStatusOnly(
        { ...user, userId: 'shipping-sender', role: Role.SHIPPING },
        handoff,
      ),
    ).toBe(true));
  it('keeps the receiving agent outcome available to that agent', () =>
    expect(
      isReminderStatusOnly({ ...user, userId: 'sales-recipient' }, handoff),
    ).toBe(false));
  it('keeps queue outcomes available to Shipping and Admin', () => {
    const queue = {
      ...handoff,
      context: 'SHIPMENT_ORDER' as const,
      ownerKind: 'SHIPPING_QUEUE' as const,
      ownerUserId: null,
    };
    expect(isReminderStatusOnly({ ...user, role: Role.SHIPPING }, queue)).toBe(
      false,
    );
    expect(isReminderStatusOnly({ ...user, role: Role.ADMIN }, queue)).toBe(
      false,
    );
    expect(isReminderStatusOnly(user, queue)).toBe(true);
  });
  it('uses 23- and 25-hour days at DST changes', () => {
    expect(
      taskDayStart('2026-03-09', 'America/New_York').getTime() -
        taskDayStart('2026-03-08', 'America/New_York').getTime(),
    ).toBe(23 * 3600000);
    expect(
      taskDayStart('2026-11-02', 'America/New_York').getTime() -
        taskDayStart('2026-11-01', 'America/New_York').getTime(),
    ).toBe(25 * 3600000);
  });
  it('uses the display date, independently of the machine clock zone', () => {
    const now = new Date('2026-11-14T06:00Z');
    expect(taskDayBounds(now, 'America/Los_Angeles').today).toBe('2026-11-13');
    expect(taskDayBounds(now, 'America/New_York').today).toBe('2026-11-14');
  });
  it.each(['2026-02-30', '2026-13-01', 'invalid'])(
    'rejects invalid date %s',
    (date) => expect(() => taskDateShift(date, 0)).toThrow(),
  );
  it('advances calendar days across month and year boundaries', () => {
    expect(taskDateShift('2026-12-31', 1)).toBe('2027-01-01');
    expect(taskDateShift('2028-02-28', 1)).toBe('2028-02-29');
  });
  it.each(['TEAM', 'UNASSIGNED', 'QUEUE'])('denies Sales scope %s', (scope) =>
    expect(() => taskScope(user, scope)).toThrow(),
  );
  it('denies Shipping the team list', () =>
    expect(() =>
      taskScope({ ...user, role: Role.SHIPPING }, 'TEAM'),
    ).toThrow());
});
