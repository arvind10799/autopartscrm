import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
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

  @Post('call-webhook')
  @ResponseMessage('RingCentral webhook processed.')
  async callWebhook(
    @Body() body: unknown,
    @Headers('validation-token') validationToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (validationToken) {
      response.setHeader('Validation-Token', validationToken);
    }

    return this.ringCentralService.handleCallWebhook(body, validationToken);
  }

  @Post('subscription')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RoleGuard)
  @ResponseMessage('RingCentral subscription created successfully.')
  createSubscription() {
    return this.ringCentralService.createCallWebhookSubscription();
  }
}
