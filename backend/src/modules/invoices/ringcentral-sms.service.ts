import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RingCentralTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

@Injectable()
export class RingCentralSmsService {
  private readonly logger = new Logger(RingCentralSmsService.name);
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('RINGCENTRAL_CLIENT_ID') &&
        this.configService.get<string>('RINGCENTRAL_CLIENT_SECRET') &&
        this.configService.get<string>('RINGCENTRAL_JWT') &&
        this.configService.get<string>('RINGCENTRAL_FROM_NUMBER'),
    );
  }

  async sendInvoiceSignatureLink(options: {
    to: string;
    customerName: string;
    invoiceNumber: string;
    signingUrl: string;
  }) {
    if (!this.isConfigured()) {
      this.logger.warn('RingCentral is not configured. Invoice SMS was not sent.');
      throw new Error('RingCentral SMS is not configured.');
    }

    const to = this.normalizePhoneNumber(options.to);
    const from = this.normalizePhoneNumber(
      this.configService.getOrThrow<string>('RINGCENTRAL_FROM_NUMBER'),
    );

    if (!to || !from) {
      throw new Error('RingCentral SMS phone number is invalid.');
    }

    const message = [
      `Hi ${options.customerName}, your MEE Auto Parts invoice ${options.invoiceNumber} is ready for signature.`,
      `Review & sign: ${options.signingUrl}`,
    ].join(' ');

    await this.sendSms({ from, to, message });
  }

  private async sendSms(options: { from: string; to: string; message: string }) {
    const accessToken = await this.getAccessToken();
    const serverUrl = this.getServerUrl();
    const response = await fetch(
      `${serverUrl}/restapi/v1.0/account/~/extension/~/sms`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: {
            phoneNumber: options.from,
          },
          to: [
            {
              phoneNumber: options.to,
            },
          ],
          text: options.message,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `RingCentral SMS failed with status ${response.status}: ${errorBody}`,
      );
    }
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

  private normalizePhoneNumber(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const trimmedValue = value.trim();
    if (trimmedValue.startsWith('+')) {
      const digits = trimmedValue.replace(/\D/g, '');
      return digits ? `+${digits}` : null;
    }

    const digits = trimmedValue.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+1${digits}`;
    }

    if (digits.length > 10) {
      return `+${digits}`;
    }

    return null;
  }
}
