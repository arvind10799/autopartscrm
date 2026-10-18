import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { WebsiteLeadStatus } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { WebsiteLeadsService } from './website-leads.service';
import { WebsiteLeadsRepository } from './website-leads.repository';
import { ConvertWebsiteLeadDto } from './dto/convert-website-lead.dto';
import {
  IntakeWebsiteLeadDto,
  WebsiteInquiryType,
} from './dto/intake-website-lead.dto';

const validSubmission: IntakeWebsiteLeadDto = {
  source: WebsiteInquiryType.QUOTE,
  externalSubmissionId: '9e1418a3-2317-49cf-8644-8ad91fc640b5',
  sourceFormId: 'quote-form',
  sourcePageUrl: 'https://meeautoparts.com/',
  submittedAt: new Date().toISOString(),
  customerEmail: 'example@example.com',
};

describe('WebsiteLeadsService intake', () => {
  const ingest = jest.fn();
  const service = new WebsiteLeadsService({
    ingest,
  } as unknown as WebsiteLeadsRepository);

  beforeEach(() => ingest.mockClear());

  it('accepts a quote from the approved website', async () => {
    ingest.mockResolvedValue({ id: 'website-lead-id' });
    await expect(service.ingest(validSubmission)).resolves.toEqual({
      id: 'website-lead-id',
    });
    expect(ingest).toHaveBeenCalledWith(validSubmission);
  });

  it('rejects the support page even with a quote source', () => {
    expect(() =>
      service.ingest({
        ...validSubmission,
        sourcePageUrl: 'https://meeautoparts.com/auto-parts-support-contact/',
      }),
    ).toThrow(BadRequestException);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('rejects another website and an inquiry with no contact method', () => {
    expect(() =>
      service.ingest({
        ...validSubmission,
        sourcePageUrl: 'https://example.com/',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      service.ingest({ ...validSubmission, customerEmail: undefined }),
    ).toThrow(BadRequestException);
    expect(ingest).not.toHaveBeenCalled();
  });
});

describe('WebsiteLeadsService sales access', () => {
  const salesUser: AuthenticatedUser = {
    userId: '11111111-1111-4111-8111-111111111111',
    name: 'Sales Agent',
    email: 'sales@example.com',
    role: Role.SALES,
  };
  const findAccessible = jest.fn();
  const update = jest.fn();
  const addNote = jest.fn();
  const convert = jest.fn();
  const claim = jest.fn();
  const service = new WebsiteLeadsService({
    findAccessible,
    update,
    addNote,
    convert,
    claim,
  } as unknown as WebsiteLeadsRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    findAccessible.mockResolvedValue({
      assignedToId: null,
      convertedLeadId: null,
      status: WebsiteLeadStatus.NEW,
    });
  });

  it('allows sales to view and claim an unassigned lead', async () => {
    claim.mockResolvedValue({ assignedToId: salesUser.userId });
    await expect(service.get('lead-id', salesUser)).resolves.toMatchObject({
      assignedToId: null,
    });
    await expect(service.claim('lead-id', salesUser)).resolves.toMatchObject({
      assignedToId: salesUser.userId,
    });
    expect(claim).toHaveBeenCalledWith('lead-id', salesUser);
  });

  it('blocks edits, notes, and conversion until a sales agent claims the lead', async () => {
    await expect(
      service.update('lead-id', { status: WebsiteLeadStatus.CONTACTED }, salesUser),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.addNote('lead-id', 'Called customer', salesUser)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.convert('lead-id', {} as ConvertWebsiteLeadDto, salesUser),
    ).rejects.toThrow(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
    expect(addNote).not.toHaveBeenCalled();
    expect(convert).not.toHaveBeenCalled();
  });

  it('allows status updates after the claim and prevents admins using the claim action', async () => {
    findAccessible.mockResolvedValue({
      assignedToId: salesUser.userId,
      convertedLeadId: null,
      status: WebsiteLeadStatus.NEW,
    });
    update.mockResolvedValue({ status: WebsiteLeadStatus.CONTACTED });
    await expect(
      service.update('lead-id', { status: WebsiteLeadStatus.CONTACTED }, salesUser),
    ).resolves.toMatchObject({ status: WebsiteLeadStatus.CONTACTED });
    expect(() =>
      service.claim('lead-id', { ...salesUser, role: Role.ADMIN }),
    ).toThrow(ForbiddenException);
  });
});
