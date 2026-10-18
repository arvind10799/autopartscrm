import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { WebsiteLeadSignatureGuard } from './website-lead-signature.guard';

describe('WebsiteLeadSignatureGuard', () => {
  const secret = 'test-secret-at-least-thirty-two-characters-long';
  const guard = new WebsiteLeadSignatureGuard({
    get: () => secret,
  } as unknown as ConfigService);
  const body = Buffer.from('{"source":"QUOTE"}');

  function context(
    timestamp: string,
    rawBody = body,
    validSignature = true,
  ): ExecutionContext {
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(body)
      .digest('hex');
    const headers: Record<string, string> = {
      'x-website-lead-timestamp': timestamp,
      'x-website-lead-signature': `sha256=${validSignature ? signature : '0'.repeat(64)}`,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          rawBody,
          header: (name: string) => headers[name],
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('accepts the exact signed body', () => {
    expect(
      guard.canActivate(context(String(Math.floor(Date.now() / 1000)))),
    ).toBe(true);
  });

  it('rejects a changed body and an expired timestamp', () => {
    const now = String(Math.floor(Date.now() / 1000));
    expect(() =>
      guard.canActivate(context(now, Buffer.from('{"source":"PART_REQUEST"}'))),
    ).toThrow();
    expect(() =>
      guard.canActivate(context(String(Math.floor(Date.now() / 1000) - 301))),
    ).toThrow();
  });
});
