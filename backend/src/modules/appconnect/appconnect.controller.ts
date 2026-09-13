import { Controller, Get, Headers, Query } from '@nestjs/common';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { AppConnectService } from './appconnect.service';
import { FindContactQueryDto } from './dto/find-contact-query.dto';

@Controller('appconnect')
export class AppConnectController {
  constructor(private readonly appConnectService: AppConnectService) {}

  @Get('find-contact')
  @ResponseMessage('App Connect contact lookup completed successfully.')
  findContact(
    @Query() query: FindContactQueryDto,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    return this.appConnectService.findContact(query.phone, authorizationHeader);
  }
}
