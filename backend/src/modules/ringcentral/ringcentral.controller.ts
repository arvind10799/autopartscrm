import { Controller, Get, Query } from '@nestjs/common';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CustomerLookupQueryDto } from './dto/customer-lookup-query.dto';
import { RingCentralService } from './ringcentral.service';

@Controller('ringcentral')
export class RingCentralController {
  constructor(private readonly ringCentralService: RingCentralService) {}

  @Get('customer-lookup')
  @ResponseMessage('Customer lookup completed successfully.')
  customerLookup(@Query() query: CustomerLookupQueryDto) {
    return this.ringCentralService.lookupCustomer(query);
  }
}
