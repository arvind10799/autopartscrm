import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { AppConnectService } from './appconnect.service';
import { FindContactQueryDto } from './dto/find-contact-query.dto';

@Controller('appconnect')
export class AppConnectController {
  constructor(private readonly appConnectService: AppConnectService) {}

  @Get('authentication')
  @ResponseMessage('App Connect authentication completed successfully.')
  authenticate(@Headers('authorization') authorizationHeader?: string) {
    return this.appConnectService.authenticate(authorizationHeader);
  }

  @Get('find-contact')
  @ResponseMessage('App Connect contact lookup completed successfully.')
  findContact(
    @Query() query: FindContactQueryDto,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    return this.appConnectService.findContact(query.phone, authorizationHeader);
  }

  @Get('order/:orderId')
  @ResponseMessage('App Connect order details loaded successfully.')
  getOrderDetails(@Param('orderId') orderId: string) {
    return this.appConnectService.getOrderDetails(orderId);
  }

  @Get('lead/:leadId')
  @ResponseMessage('App Connect lead details loaded successfully.')
  getLeadDetails(@Param('leadId') leadId: string) {
    return this.appConnectService.getLeadDetails(leadId);
  }
}
