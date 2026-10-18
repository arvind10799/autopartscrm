import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const MAX_CLOCK_SKEW_SECONDS = 300;

@Injectable()
export class WebsiteLeadSignatureGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { rawBody?: Buffer }>();
    const secret = this.configService.get<string>(
      'WEBSITE_LEADS_SIGNING_SECRET',
    );
    const timestamp = request.header('x-website-lead-timestamp');
    const signature = request.header('x-website-lead-signature');
    const rawBody = request.rawBody;

    if (
      !secret ||
      secret.length < 32 ||
      !timestamp ||
      !/^\d{10}$/.test(timestamp) ||
      !signature ||
      !/^sha256=[a-f0-9]{64}$/.test(signature) ||
      !rawBody
    ) {
      throw new UnauthorizedException('Website lead signature is invalid.');
    }

    if (
      Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) >
      MAX_CLOCK_SKEW_SECONDS
    ) {
      throw new UnauthorizedException('Website lead signature has expired.');
    }

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest();
    const received = Buffer.from(signature.slice(7), 'hex');

    if (!timingSafeEqual(expected, received)) {
      throw new UnauthorizedException('Website lead signature is invalid.');
    }

    return true;
  }
}
