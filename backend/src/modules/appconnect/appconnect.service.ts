import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RingCentralService } from '../ringcentral/ringcentral.service';
import type {
  AppConnectAuthenticationResponse,
  AppConnectFindContactResponse,
  AppConnectMatchedContact,
  AppConnectRecordDetailResponse,
} from './types/appconnect.types';

type ExistingLookupResult = Extract<
  Awaited<ReturnType<RingCentralService['lookupCustomerByPhone']>>,
  { exists: true }
>;

@Injectable()
export class AppConnectService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly ringCentralService: RingCentralService,
  ) {}

  authenticate(
    authorizationHeader?: string,
  ): AppConnectAuthenticationResponse {
    this.assertBearerToken(authorizationHeader);

    return {
      user: {
        username: 'Mee Auto Parts CRM',
      },
      message: 'ok',
    };
  }

  async findContact(
    phone: string,
    authorizationHeader?: string,
  ): Promise<AppConnectFindContactResponse> {
    this.assertBearerToken(authorizationHeader);
    const lookupResult =
      await this.ringCentralService.lookupCustomerByPhone(phone);

    if (!lookupResult.exists) {
      return {
        successful: true,
        matchedContactInfo: [],
      };
    }

    return {
      successful: true,
      matchedContactInfo: [this.toMatchedContact(lookupResult)],
    };
  }

  async getOrderDetails(
    orderId: string,
  ): Promise<AppConnectRecordDetailResponse> {
    this.assertUuid(orderId, 'Order identifier is invalid.');
    const order = await this.prismaService.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        salesNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        partDescription: true,
        price: true,
        quantity: true,
        totalSaleAmount: true,
        currency: true,
        status: true,
        paymentMethod: true,
        intakeDetails: true,
        createdAt: true,
        createdBy: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order was not found.');
    }

    const intakeDetails = this.getRecord(order.intakeDetails);
    const vehicle = this.joinValues([
      this.getString(intakeDetails, 'vehicleYear'),
      this.getString(intakeDetails, 'vehicleMake'),
      this.getString(intakeDetails, 'vehicleModel'),
      this.getString(intakeDetails, 'vehicleVariant'),
    ]);

    return {
      title: 'Existing Customer',
      subtitle: order.customerName,
      badge: order.orderNumber,
      crmUrl: `https://crm.meeautoparts.com/orders/${order.id}`,
      rows: [
        { label: 'Customer', value: order.customerName },
        { label: 'Phone', value: this.formatNullable(order.customerPhone) },
        { label: 'Email', value: this.formatNullable(order.customerEmail) },
        { label: 'Order Number', value: order.orderNumber },
        { label: 'Sales Number', value: this.formatNullable(order.salesNumber) },
        {
          label: 'Order Date',
          value: this.formatDate(
            this.getString(intakeDetails, 'orderDate') ?? order.createdAt,
          ),
        },
        { label: 'Status', value: this.formatEnum(order.status) },
        { label: 'Vehicle', value: vehicle || 'Not available' },
        {
          label: 'VIN',
          value: this.formatNullable(
            this.getString(intakeDetails, 'vehicleVin'),
          ),
        },
        { label: 'Part', value: order.partDescription },
        { label: 'Quantity', value: String(order.quantity) },
        {
          label: 'Sale Amount',
          value: this.formatCurrency(order.totalSaleAmount, order.currency),
        },
        {
          label: 'Payment Method',
          value: this.formatNullable(this.formatEnum(order.paymentMethod)),
        },
        { label: 'Advisor', value: order.createdBy.name },
      ],
    };
  }

  async getLeadDetails(
    leadId: string,
  ): Promise<AppConnectRecordDetailResponse> {
    this.assertUuid(leadId, 'Lead identifier is invalid.');
    const lead = await this.prismaService.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        adviserName: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        state: true,
        partDescription: true,
        vehicleYear: true,
        vehicleMake: true,
        vehicleModel: true,
        vehicleVariant: true,
        quote: true,
        quoteCurrency: true,
        status: true,
        leadDate: true,
        convertedOrderId: true,
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead was not found.');
    }

    if (lead.convertedOrderId) {
      return this.getOrderDetails(lead.convertedOrderId);
    }

    const vehicle = this.joinValues([
      lead.vehicleYear,
      lead.vehicleMake,
      lead.vehicleModel,
      lead.vehicleVariant,
    ]);

    return {
      title: 'Existing Lead',
      subtitle: lead.customerName,
      badge: this.formatEnum(lead.status),
      crmUrl: 'https://crm.meeautoparts.com/leads',
      rows: [
        { label: 'Lead Name', value: lead.customerName },
        { label: 'Phone', value: lead.customerPhone },
        { label: 'Email', value: this.formatNullable(lead.customerEmail) },
        { label: 'State', value: this.formatNullable(lead.state) },
        { label: 'Vehicle', value: vehicle || 'Not available' },
        { label: 'Part Description', value: lead.partDescription },
        {
          label: 'Quote',
          value: this.formatCurrency(lead.quote, lead.quoteCurrency),
        },
        { label: 'Status', value: this.formatEnum(lead.status) },
        { label: 'Lead Date', value: this.formatDate(lead.leadDate) },
        { label: 'Advisor', value: lead.adviserName },
      ],
    };
  }

  private assertBearerToken(authorizationHeader?: string) {
    const token = this.extractBearerToken(authorizationHeader);

    if (!token) {
      throw new UnauthorizedException('Missing App Connect bearer token.');
    }

    this.ringCentralService.assertLookupToken(token);
  }

  private extractBearerToken(authorizationHeader?: string): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

    if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
      return null;
    }

    return token.trim();
  }

  private toMatchedContact(
    lookupResult: ExistingLookupResult,
  ): AppConnectMatchedContact {
    return {
      id: `${lookupResult.recordType}:${lookupResult.recordId}`,
      name: lookupResult.customerName,
      phone: this.toE164Phone(lookupResult.phone),
      type: lookupResult.recordType,
      additionalInfo:
        lookupResult.recordType === 'order'
          ? { orderNumber: lookupResult.recordLabel }
          : { leadId: lookupResult.recordId },
    };
  }

  private toE164Phone(phone: string | null): string {
    const digits = phone?.replace(/\D/g, '') ?? '';

    if (digits.length === 10) {
      return `+1${digits}`;
    }

    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    return digits ? `+${digits}` : '';
  }

  private assertUuid(value: string, message: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      throw new BadRequestException(message);
    }
  }

  private getRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private getString(
    record: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = record[key];

    return typeof value === 'string' && value.trim()
      ? value.trim()
      : null;
  }

  private joinValues(values: Array<string | null | undefined>): string {
    return values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .join(' ');
  }

  private formatNullable(value?: string | null): string {
    return value?.trim() ? value.trim() : 'Not available';
  }

  private formatEnum(value?: string | null): string {
    if (!value) {
      return 'Not available';
    }

    return value
      .toLowerCase()
      .split('_')
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ');
  }

  private formatDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return typeof value === 'string' ? value : 'Not available';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  private formatCurrency(
    amount: Prisma.Decimal | string | null,
    currency: string,
  ): string {
    if (amount === null) {
      return 'Not available';
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
      return 'Not available';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(numericAmount);
  }
}
