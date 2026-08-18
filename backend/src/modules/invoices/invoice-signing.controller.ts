import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { resolveClientIpAddress } from '../../common/utils/resolve-client-ip-address';
import { SignInvoiceDto } from './dto/sign-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoice-signing')
export class InvoiceSigningController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':token')
  findByToken(@Param('token') token: string, @Req() request: Request) {
    return this.invoicesService.findBySigningToken(
      token,
      resolveClientIpAddress(request),
    );
  }

  @Post(':token/sign')
  signInvoice(
    @Param('token') token: string,
    @Body() signInvoiceDto: SignInvoiceDto,
    @Req() request: Request,
  ) {
    return this.invoicesService.signWithToken(
      token,
      signInvoiceDto,
      resolveClientIpAddress(request),
    );
  }

  @Post(':token/terms-acceptance')
  acceptTerms(@Param('token') token: string, @Req() request: Request) {
    return this.invoicesService.acceptTermsWithToken(
      token,
      resolveClientIpAddress(request),
    );
  }
}
