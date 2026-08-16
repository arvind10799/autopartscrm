import type { Request } from 'express';

export function resolveClientIpAddress(request: Request): string | undefined {
  const forwardedFor = getHeaderValue(request.headers['x-forwarded-for']);
  const forwardedIp = forwardedFor
    ?.split(',')
    .map((ipAddress) => normalizeIpAddress(ipAddress))
    .find((ipAddress): ipAddress is string => Boolean(ipAddress));
  const realIp = normalizeIpAddress(getHeaderValue(request.headers['x-real-ip']));
  const requestIp = normalizeIpAddress(request.ip);
  const socketIp = normalizeIpAddress(request.socket.remoteAddress);

  return forwardedIp ?? realIp ?? requestIp ?? socketIp;
}

function getHeaderValue(headerValue: string | string[] | undefined): string | undefined {
  if (Array.isArray(headerValue)) {
    return headerValue[0];
  }

  return headerValue;
}

function normalizeIpAddress(ipAddress?: string): string | undefined {
  const normalizedIpAddress = ipAddress?.trim();

  if (!normalizedIpAddress) {
    return undefined;
  }

  if (normalizedIpAddress.startsWith('::ffff:')) {
    return normalizedIpAddress.replace('::ffff:', '');
  }

  if (normalizedIpAddress === '::1') {
    return '127.0.0.1';
  }

  return normalizedIpAddress;
}
