import { BadRequestException } from '@nestjs/common';
import { WebsiteLeadsService } from './website-leads.service';
import { WebsiteLeadsRepository } from './website-leads.repository';
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
