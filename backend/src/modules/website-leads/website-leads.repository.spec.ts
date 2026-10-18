import { ConflictException } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { WebsiteLeadsRepository } from './website-leads.repository';

describe('WebsiteLeadsRepository visibility and claiming', () => {
  const salesUser: AuthenticatedUser = {
    userId: '11111111-1111-4111-8111-111111111111',
    name: 'Sales Agent',
    email: 'sales@example.com',
    role: Role.SALES,
  };
  const findMany = jest.fn();
  const count = jest.fn();
  const findFirst = jest.fn();
  const updateMany = jest.fn();
  const findUniqueOrThrow = jest.fn();
  const prisma = {
    websiteLead: { findMany, count, findFirst, updateMany, findUniqueOrThrow },
    $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
  } as unknown as PrismaService;
  const repository = new WebsiteLeadsRepository(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
  });

  it('shows sales only unassigned inquiries and inquiries assigned to them', async () => {
    await repository.list({ page: 1, limit: 20 }, salesUser);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { assignedToId: null, status: { not: 'CONVERTED' } },
                { assignedToId: salesUser.userId },
              ],
            },
            {},
          ],
        }),
      }),
    );
    await repository.findAccessible('lead-id', salesUser).catch(() => undefined);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'lead-id',
          AND: [
            {
              OR: [
                { assignedToId: null, status: { not: 'CONVERTED' } },
                { assignedToId: salesUser.userId },
              ],
            },
          ],
        },
      }),
    );
  });

  it('filters unassigned and mine without exposing other agents', async () => {
    await repository.list(
      { page: 1, limit: 20, assignment: 'UNASSIGNED' },
      salesUser,
    );
    expect(findMany.mock.calls[0][0].where.AND[1]).toEqual({ assignedToId: null });
    await repository.list({ page: 1, limit: 20, assignment: 'MINE' }, salesUser);
    expect(findMany.mock.calls[1][0].where.AND[1]).toEqual({
      assignedToId: salesUser.userId,
    });
  });

  it('claims only a still-unassigned inquiry and rejects a competing claim', async () => {
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    findUniqueOrThrow.mockResolvedValue({ assignedToId: salesUser.userId });
    await expect(repository.claim('lead-id', salesUser)).resolves.toMatchObject({
      assignedToId: salesUser.userId,
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'lead-id', assignedToId: null }),
        data: { assignedToId: salesUser.userId },
      }),
    );
    await expect(repository.claim('lead-id', salesUser)).rejects.toThrow(
      ConflictException,
    );
  });
});
