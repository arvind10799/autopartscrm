import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class ReleasesService {
  constructor(private readonly prisma: PrismaService) {}

  async hasSeen(userId: string, releaseId: string) {
    this.validateReleaseId(releaseId);
    const acknowledgement = await this.prisma.releaseAcknowledgement.findUnique({
      where: { userId_releaseId: { userId, releaseId } },
      select: { seenAt: true },
    });
    return { seen: Boolean(acknowledgement) };
  }

  async markSeen(userId: string, releaseId: string) {
    this.validateReleaseId(releaseId);
    await this.prisma.releaseAcknowledgement.upsert({
      where: { userId_releaseId: { userId, releaseId } },
      create: { userId, releaseId },
      update: {},
    });
    return { seen: true };
  }

  private validateReleaseId(releaseId: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(releaseId)) {
      throw new BadRequestException('Invalid release identifier.');
    }
  }
}
