import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RingCentralService } from '../ringcentral/ringcentral.service';
import type {
  AppConnectFindContactResponse,
  AppConnectMatchedContact,
} from './types/appconnect.types';

type ExistingLookupResult = Extract<
  Awaited<ReturnType<RingCentralService['lookupCustomerByPhone']>>,
  { exists: true }
>;

@Injectable()
export class AppConnectService {
  constructor(private readonly ringCentralService: RingCentralService) {}

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
}
