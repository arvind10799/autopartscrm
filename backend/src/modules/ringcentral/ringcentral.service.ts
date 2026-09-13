import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CustomerLookupQueryDto } from './dto/customer-lookup-query.dto';

type CustomerLookupMatch = {
  exists: true;
  customerName: string;
  phone: string | null;
  recordType: 'order' | 'lead';
  recordId: string;
  recordLabel: string;
  crmUrl: string;
};

type CustomerLookupMiss = {
  exists: false;
  phone: string;
  message: string;
};

type CustomerLookupResult = CustomerLookupMatch | CustomerLookupMiss;

type RingCentralTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type RingCentralSubscriptionResponse = {
  id?: string;
  expirationTime?: string;
  expiresIn?: number;
};

type OrderLookupRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  createdAt: Date;
};

type LeadLookupRow = {
  id: string;
  customerName: string;
  customerPhone: string;
  leadDate: Date;
};

@Injectable()
export class RingCentralService {
  private readonly logger = new Logger(RingCentralService.name);
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async lookupCustomer(
    query: CustomerLookupQueryDto,
  ): Promise<CustomerLookupResult> {
    this.assertLookupToken(query.token);

    return this.lookupCustomerByPhone(query.phone);
  }

  async handleCallWebhook(body: unknown, validationToken?: string) {
    if (this.isValidationRequest(body)) {
      return { received: true, validation: true };
    }

    this.assertWebhookToken(validationToken);

    const callEvent = this.extractIncomingCallEvent(body);
    if (!callEvent) {
      return { received: true, ignored: true };
    }

    const match = await this.lookupCustomerByPhone(callEvent.callerPhone);
    const matchedRecordType = match.exists ? match.recordType : null;
    const matchedRecordId = match.exists ? match.recordId : null;

    try {
      await this.prismaService.ringCentralCallEvent.create({
        data: {
          telephonySessionId: callEvent.telephonySessionId,
          callerPhone: callEvent.callerPhone,
          matchedRecordType,
          matchedRecordId,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return { received: true, duplicate: true };
      }

      throw error;
    }

    if (match.exists) {
      await this.notificationsService.notifyIncomingCustomerCall({
        customerName: match.customerName,
        callerPhone: match.phone ?? callEvent.callerPhone,
        recordType: match.recordType,
        recordId: match.recordId,
        recordLabel: match.recordLabel,
      });
    }

    return { received: true, matched: match.exists };
  }

  async createCallWebhookSubscription() {
    const accessToken = await this.getAccessToken();
    const serverUrl = this.getServerUrl();
    const webhookToken = this.getWebhookToken();
    const address = `${this.getAppBaseUrl()}/api/ringcentral/call-webhook`;
    const response = await fetch(`${serverUrl}/restapi/v1.0/subscription`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventFilters: ['/restapi/v1.0/account/~/telephony/sessions'],
        deliveryMode: {
          transportType: 'WebHook',
          address,
          validationToken: webhookToken,
        },
        expiresIn: 604800,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `RingCentral subscription failed with status ${response.status}: ${errorBody}`,
      );
    }

    const subscription =
      (await response.json()) as RingCentralSubscriptionResponse;

    return {
      id: subscription.id ?? null,
      expirationTime: subscription.expirationTime ?? null,
      expiresIn: subscription.expiresIn ?? null,
      address,
    };
  }

  private async lookupCustomerByPhone(
    phone: string,
  ): Promise<CustomerLookupResult> {
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
      };
    }

    return {
      exists: false,
      phone,
      message: 'No existing customer found.',
    };
  }

  private assertLookupToken(token: string) {
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

  private assertWebhookToken(validationToken?: string) {
    const configuredToken = this.getWebhookToken();

    if (!validationToken || validationToken.trim() !== configuredToken) {
      throw new UnauthorizedException('Invalid RingCentral webhook token.');
    }
  }

  private getWebhookToken(): string {
    const configuredToken = this.configService
      .get<string>('RINGCENTRAL_WEBHOOK_TOKEN')
      ?.trim();

    if (!configuredToken) {
      throw new ServiceUnavailableException(
        'RingCentral webhook token is not configured.',
      );
    }

    return configuredToken;
  }

  private isValidationRequest(body: unknown): boolean {
    if (body === null || body === undefined) {
      return true;
    }

    return (
      typeof body === 'object' &&
      !Array.isArray(body) &&
      Object.keys(body).length === 0
    );
  }

  private extractIncomingCallEvent(
    body: unknown,
  ): { telephonySessionId: string; callerPhone: string } | null {
    const payload = this.asRecord(body);
    const eventBody = this.asRecord(payload?.body);
    const parties = Array.isArray(eventBody?.parties) ? eventBody.parties : [];
    const inboundParty = parties
      .map((party) => this.asRecord(party))
      .find((party) => {
        const direction = String(party?.direction ?? '').toLowerCase();
        const status = this.asRecord(party?.status);
        const statusCode = String(status?.code ?? '').toLowerCase();

        return (
          direction === 'inbound' &&
          !['answered', 'disconnected', 'gone', 'voicemail'].includes(statusCode)
        );
      });
    const from = this.asRecord(inboundParty?.from);
    const callerPhone =
      typeof from?.phoneNumber === 'string' ? from.phoneNumber : null;
    const telephonySessionId =
      this.getString(eventBody?.telephonySessionId) ??
      this.getString(eventBody?.sessionId) ??
      this.getString(payload?.uuid);

    if (!callerPhone || !telephonySessionId) {
      return null;
    }

    try {
      this.normalizePhoneForLookup(callerPhone);
    } catch {
      this.logger.warn(`Ignored RingCentral call with invalid phone: ${callerPhone}`);
      return null;
    }

    return {
      telephonySessionId,
      callerPhone,
    };
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
      SELECT id, "customerName", "customerPhone", "leadDate"
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

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessTokenExpiresAt > Date.now()) {
      return this.accessToken;
    }

    const clientId = this.configService.getOrThrow<string>(
      'RINGCENTRAL_CLIENT_ID',
    );
    const clientSecret = this.configService.getOrThrow<string>(
      'RINGCENTRAL_CLIENT_SECRET',
    );
    const jwt = this.configService.getOrThrow<string>('RINGCENTRAL_JWT');
    const serverUrl = this.getServerUrl();
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    });
    const response = await fetch(`${serverUrl}/restapi/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`,
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `RingCentral auth failed with status ${response.status}: ${errorBody}`,
      );
    }

    const tokenResponse = (await response.json()) as RingCentralTokenResponse;
    if (!tokenResponse.access_token) {
      throw new Error('RingCentral auth response did not include an access token.');
    }

    this.accessToken = tokenResponse.access_token;
    this.accessTokenExpiresAt =
      Date.now() + Math.max((tokenResponse.expires_in ?? 3600) - 60, 60) * 1000;

    return this.accessToken;
  }

  private getServerUrl(): string {
    return this.configService
      .get<string>('RINGCENTRAL_SERVER_URL', 'https://platform.ringcentral.com')
      .replace(/\/$/, '');
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private getString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
