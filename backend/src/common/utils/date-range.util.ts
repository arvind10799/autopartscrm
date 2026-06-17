import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function buildCreatedAtFilter(
  createdFrom?: string,
  createdTo?: string,
): Prisma.DateTimeFilter | undefined {
  if (!createdFrom && !createdTo) {
    return undefined;
  }

  const fromDate = createdFrom ? new Date(createdFrom) : undefined;
  const toDate = createdTo ? new Date(createdTo) : undefined;

  if (fromDate && Number.isNaN(fromDate.getTime())) {
    throw new BadRequestException('createdFrom must be a valid timestamp.');
  }

  if (toDate && Number.isNaN(toDate.getTime())) {
    throw new BadRequestException('createdTo must be a valid timestamp.');
  }

  if (fromDate && toDate && fromDate > toDate) {
    throw new BadRequestException(
      'createdFrom must be earlier than or equal to createdTo.',
    );
  }

  return {
    ...(fromDate ? { gte: fromDate } : {}),
    ...(toDate ? { lte: toDate } : {}),
  };
}
