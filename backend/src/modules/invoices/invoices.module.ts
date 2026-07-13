import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotesModule } from '../notes/notes.module';
import { InvoiceMailService } from './invoice-mail.service';
import { InvoiceSigningController } from './invoice-signing.controller';
import { InvoicesController } from './invoices.controller';
import { InvoicesRepository } from './invoices.repository';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [AuthModule, NotesModule],
  controllers: [InvoicesController, InvoiceSigningController],
  providers: [InvoicesService, InvoicesRepository, InvoiceMailService],
})
export class InvoicesModule {}
