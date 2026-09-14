import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CustomerLookupQueryDto } from './dto/customer-lookup-query.dto';

export type CustomerLookupMatch = {
  exists: true;
  customerName: string;
  phone: string | null;
  recordType: 'order' | 'lead';
  recordId: string;
  recordLabel: string;
  crmUrl: string;
  leadDetails?: {
    adviserName: string;
    customerEmail: string | null;
    state: string | null;
    partDescription: string;
    vehicleYear: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehicleVariant: string | null;
    quote: string | null;
    quoteCurrency: string;
    status: string;
    leadDate: Date;
  };
};

export type CustomerLookupMiss = {
  exists: false;
  phone: string;
  message: string;
};

export type CustomerLookupResult = CustomerLookupMatch | CustomerLookupMiss;

type OrderLookupRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  createdAt: Date;
};

type LeadLookupRow = {
  id: string;
  adviserName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  state: string | null;
  partDescription: string;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleVariant: string | null;
  quote: string | null;
  quoteCurrency: string;
  status: string;
  leadDate: Date;
};

@Injectable()
export class RingCentralService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async lookupCustomer(
    query: CustomerLookupQueryDto,
  ): Promise<CustomerLookupResult> {
    this.assertLookupToken(query.token);

    return this.lookupCustomerByPhone(query.phone);
  }

  async lookupCustomerByPhone(phone: string): Promise<CustomerLookupResult> {
    const phoneKey = this.normalizePhoneForLookup(phone);

    const order = await this.findLatestOrderByPhone(phoneKey);
    if (order) {
      return {
        exists: true,
        customerName: order.customerName,
        phone: order.customerPhone,
        recordType: 'order',
        recordId: order.id,
        recordLabel: order.orderNumber,
        crmUrl: this.buildCrmUrl(`/orders/${order.id}`),
      };
    }

    const lead = await this.findLatestLeadByPhone(phoneKey);
    if (lead) {
      return {
        exists: true,
        customerName: lead.customerName,
        phone: lead.customerPhone,
        recordType: 'lead',
        recordId: lead.id,
        recordLabel: 'Lead',
        crmUrl: this.buildCrmUrl('/leads'),
        leadDetails: {
          adviserName: lead.adviserName,
          customerEmail: lead.customerEmail,
          state: lead.state,
          partDescription: lead.partDescription,
          vehicleYear: lead.vehicleYear,
          vehicleMake: lead.vehicleMake,
          vehicleModel: lead.vehicleModel,
          vehicleVariant: lead.vehicleVariant,
          quote: lead.quote,
          quoteCurrency: lead.quoteCurrency,
          status: lead.status,
          leadDate: lead.leadDate,
        },
      };
    }

    return {
      exists: false,
      phone,
      message: 'No existing customer found.',
    };
  }

  assertLookupToken(token: string) {
    const configuredToken = this.configService
      .get<string>('RINGCENTRAL_LOOKUP_TOKEN')
      ?.trim();

    if (!configuredToken) {
      throw new ServiceUnavailableException(
        'RingCentral customer lookup is not configured.',
      );
    }

    if (token.trim() !== configuredToken) {
      throw new UnauthorizedException('Invalid lookup token.');
    }
  }

  private normalizePhoneForLookup(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    if (digits.length < 10) {
      throw new BadRequestException(
        'Phone number must include at least 10 digits.',
      );
    }

    return digits.slice(-10);
  }

  private async findLatestOrderByPhone(
    phoneKey: string,
  ): Promise<OrderLookupRow | null> {
    const matches = await this.prismaService.$queryRaw<OrderLookupRow[]>`
      SELECT id, "orderNumber", "customerName", "customerPhone", "createdAt"
      FROM "Order"
      WHERE RIGHT(regexp_replace(COALESCE("customerPhone", ''), '[^0-9]', '', 'g'), 10) = ${phoneKey}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;

    return matches[0] ?? null;
  }

  private async findLatestLeadByPhone(
    phoneKey: string,
  ): Promise<LeadLookupRow | null> {
    const matches = await this.prismaService.$queryRaw<LeadLookupRow[]>`
      SELECT
        id,
        "adviserName",
        "customerName",
        "customerPhone",
        "customerEmail",
        state,
        "partDescription",
        "vehicleYear",
        "vehicleMake",
        "vehicleModel",
        "vehicleVariant",
        CAST(quote AS TEXT) AS quote,
        "quoteCurrency",
        status,
        "leadDate"
      FROM "Lead"
      WHERE RIGHT(regexp_replace("customerPhone", '[^0-9]', '', 'g'), 10) = ${phoneKey}
      ORDER BY "leadDate" DESC
      LIMIT 1
    `;

    return matches[0] ?? null;
  }

  private buildCrmUrl(path: string): string {
    return `${this.getAppBaseUrl()}${path}`;
  }

  private getAppBaseUrl(): string {
    return this.configService
      .get<string>('APP_BASE_URL', 'http://localhost:3001')
      .replace(/\/$/, '');
  }
}
