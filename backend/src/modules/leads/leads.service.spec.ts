import { BadRequestException } from '@nestjs/common';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { LeadsService } from './leads.service';

describe('LeadsService', () => {
  const leadsRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findEditableById: jest.fn(),
    update: jest.fn(),
  };

  const salesUser: AuthenticatedUser = {
    userId: 'sales-user-id',
    name: 'Sales User',
    email: 'sales@example.com',
    role: Role.SALES,
  };

  let service: LeadsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LeadsService(leadsRepository as never);
  });

  it('rejects an empty lead update', async () => {
    await expect(service.update('lead-id', {}, salesUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(leadsRepository.findEditableById).not.toHaveBeenCalled();
  });

  it('checks edit access before updating an open lead', async () => {
    leadsRepository.findEditableById.mockResolvedValue({
      id: 'lead-id',
      convertedAt: null,
    });
    leadsRepository.update.mockResolvedValue({
      id: 'lead-id',
      status: LeadStatus.CALL_BACK_LATER,
    });

    const result = await service.update(
      'lead-id',
      { status: LeadStatus.CALL_BACK_LATER },
      salesUser,
    );

    expect(leadsRepository.findEditableById).toHaveBeenCalledWith(
      'lead-id',
      salesUser,
    );
    expect(leadsRepository.update).toHaveBeenCalledWith('lead-id', {
      status: LeadStatus.CALL_BACK_LATER,
    });
    expect(result).toEqual({
      id: 'lead-id',
      status: LeadStatus.CALL_BACK_LATER,
    });
  });
});
