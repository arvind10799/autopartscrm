import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function handlePrismaError(error: unknown, entityName: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        throw new ConflictException(`${entityName} already exists.`);
      case 'P2003':
        throw new BadRequestException(
          `A related record required for ${entityName} is invalid or missing.`,
        );
      case 'P2025':
        throw new NotFoundException(`${entityName} was not found.`);
      default:
        throw new InternalServerErrorException(
          `Database operation failed for ${entityName}.`,
        );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new BadRequestException(`Invalid data supplied for ${entityName}.`);
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new InternalServerErrorException(
    `Unexpected failure while processing ${entityName}.`,
  );
}
