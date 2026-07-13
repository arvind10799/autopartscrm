import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SignInvoiceDto } from './dto/sign-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoice-signing')
export class InvoiceSigningController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.invoicesService.findBySigningToken(token);
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
      this.resolveIpAddress(request),
    );
  }

  private resolveIpAddress(request: Request): string | undefined {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0]?.trim();
    }

    return request.ip;
  }
}
