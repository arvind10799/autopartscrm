import { icsText, foldCalendarLine } from './reminder-calendar-export.service';
import {
  orderReminderContext,
  tableReminderScope,
  futureReminderWhere,
} from './reminder-table';
import { Role } from '../../common/enums/role.enum';
const sales = {
  userId: 'sales',
  role: Role.SALES,
  name: 'Synthetic',
  email: 'test@example.test',
};
describe('reminder exports and table scope', () => {
  it('escapes calendar text without allowing injected properties or control bytes', () => {
    expect(icsText('one,two;three\\four\r\nATTENDEE:secret\u0000')).toBe(
      'one\\,two\\;three\\\\four\\nATTENDEE:secret',
    );
  });
  it('folds Unicode lines within the 75-octet limit without splitting characters', () => {
    const line = 'SUMMARY:' + '🚗 customer — '.repeat(20),
      folded = foldCalendarLine(line);
    for (const part of folded.split('\r\n'))
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });
  it('keeps short lines unchanged', () =>
    expect(foldCalendarLine('VERSION:2.0')).toBe('VERSION:2.0'));
  it('does not expose Shipping tasks to Sales table cells', () =>
    expect(tableReminderScope('SHIPMENT', sales)).toEqual({ id: { in: [] } }));
  it('requires both task ownership and record ownership for Sales summaries', () =>
    expect(tableReminderScope('LEAD', sales)).toMatchObject({
      ownerUserId: 'sales',
      lead: { createdById: 'sales' },
    }));
  it('distinguishes future follow-ups from overdue-only records', () => {
    const now = new Date('2030-01-01Z');
    expect(futureReminderWhere('LEAD', sales, now)).toMatchObject({
      dueAt: { gt: now },
      deletedAt: null,
      status: { in: ['OPEN', 'SNOOZED'] },
    });
  });
  it('rejects Sales use of the Shipment Orders reminder context', () =>
    expect(() => orderReminderContext(sales, 'SHIPMENT_ORDER')).toThrow());
  it('defaults Shipping table context to the shared queue', () =>
    expect(orderReminderContext({ ...sales, role: Role.SHIPPING })).toBe(
      'SHIPMENT_ORDER',
    ));
});
