import { configuredCustomerTimeZone } from './reminder-policy-settings';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, ReminderContext } from '@prisma/client';
import { customerTimeZone, DEFAULT_REMINDER_TIME_ZONE } from './reminder-time';

const ownerSelect = { id: true, isActive: true, role: true } as const;
const orderSelect = {
  id: true,
  billingState: true,
  status: true,
  createdBy: { select: ownerSelect },
} as const;
export type ReminderLinks = {
  websiteLeadId?: string;
  leadId?: string;
  orderId?: string;
  shipmentId?: string;
  replacementId?: string;
};
export interface ReminderRecord {
  links: ReminderLinks;
  owner: { id: string; isActive: boolean; role: string } | null;
  timeZone: string;
  closed: boolean;
}

export async function resolveReminderRecord(
  tx: Prisma.TransactionClient,
  context: ReminderContext,
  recordId?: string,
): Promise<ReminderRecord> {
  if (context === 'PERSONAL') {
    if (recordId)
      throw new BadRequestException(
        'Personal reminders cannot link to a record.',
      );
    return {
      links: {},
      owner: null,
      timeZone: DEFAULT_REMINDER_TIME_ZONE,
      closed: false,
    };
  }
  if (!recordId) throw new BadRequestException('A linked record is required.');
  if (context === 'WEBSITE_LEAD') {
    const lead = await tx.websiteLead.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        state: true,
        status: true,
        assignedTo: { select: ownerSelect },
      },
    });
    if (!lead) throw new NotFoundException('Website lead was not found.');
    return {
      links: { websiteLeadId: lead.id },
      owner: lead.assignedTo,
      timeZone: await configuredCustomerTimeZone(tx, lead.state),
      closed: ['CLOSED', 'CONVERTED'].includes(lead.status),
    };
  }
  if (context === 'LEAD') {
    const lead = await tx.lead.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        state: true,
        convertedOrderId: true,
        createdBy: { select: ownerSelect },
      },
    });
    if (!lead) throw new NotFoundException('Lead was not found.');
    return {
      links: { leadId: lead.id },
      owner: lead.createdBy,
      timeZone: await configuredCustomerTimeZone(tx, lead.state),
      closed: Boolean(lead.convertedOrderId),
    };
  }
  if (context === 'ORDER' || context === 'SHIPMENT_ORDER') {
    const order = await tx.order.findUnique({
      where: { id: recordId },
      select: orderSelect,
    });
    if (!order) throw new NotFoundException('Order was not found.');
    return {
      links: { orderId: order.id },
      owner: order.createdBy,
      timeZone: await configuredCustomerTimeZone(tx, order.billingState),
      closed: ['CANCELLED', 'REFUNDED'].includes(order.status),
    };
  }
  if (context === 'SHIPMENT') {
    const shipment = await tx.shipment.findUnique({
      where: { id: recordId },
      select: { id: true, status: true, order: { select: orderSelect } },
    });
    if (!shipment) throw new NotFoundException('Shipment was not found.');
    return {
      links: { shipmentId: shipment.id, orderId: shipment.order.id },
      owner: shipment.order.createdBy,
      timeZone: await configuredCustomerTimeZone(
        tx,
        shipment.order.billingState,
      ),
      closed:
        shipment.status === 'CANCELLED' ||
        ['CANCELLED', 'REFUNDED'].includes(shipment.order.status),
    };
  }
  if (context === 'REPLACEMENT') {
    const replacement = await tx.replacementRequest.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        shipmentId: true,
        replacementStatus: true,
        order: { select: orderSelect },
      },
    });
    if (!replacement) throw new NotFoundException('Replacement was not found.');
    return {
      links: {
        replacementId: replacement.id,
        orderId: replacement.order.id,
        ...(replacement.shipmentId
          ? { shipmentId: replacement.shipmentId }
          : {}),
      },
      owner: replacement.order.createdBy,
      timeZone: await configuredCustomerTimeZone(
        tx,
        replacement.order.billingState,
      ),
      closed:
        replacement.replacementStatus === 'DELIVERED' ||
        ['CANCELLED', 'REFUNDED'].includes(replacement.order.status),
    };
  }
  throw new BadRequestException('Unsupported reminder context.');
}
