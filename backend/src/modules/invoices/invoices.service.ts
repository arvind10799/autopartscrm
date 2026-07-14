import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { NoteEntityType } from '../../common/enums/note-entity-type.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { NotesService } from '../notes/notes.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { SignInvoiceDto } from './dto/sign-invoice.dto';
import { InvoiceMailService } from './invoice-mail.service';
import {
  InvoiceOrder,
  InvoicesRepository,
} from './invoices.repository';

const SIGNED_INVOICE_STATUS = 'SIGNED';
const SIGNATURE_REQUESTED_STATUS = 'SIGNATURE_REQUESTED';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly configService: ConfigService,
    private readonly invoicesRepository: InvoicesRepository,
    private readonly invoiceMailService: InvoiceMailService,
    private readonly notesService: NotesService,
  ) {}

  async getDefaults(orderId: string, user: AuthenticatedUser) {
    const order = await this.invoicesRepository.findAccessibleOrder(orderId, user);
    this.assertOrderCanGenerateInvoice(order);
    const intakeDetails = this.normalizeIntakeDetails(order.intakeDetails);
    const salesAssistant =
      this.getString(intakeDetails.advisorName) ?? order.createdBy.name;

    return {
      invoiceNumber: order.orderNumber,
      invoiceDate: this.formatDateInputValue(new Date()),
      salesAssistant,
      customerName: order.customerName,
      contactNumber:
        this.getString(intakeDetails.billingPhone) ??
        this.getString(intakeDetails.shippingPhone) ??
        order.customerPhone ??
        '',
      billingAddress: this.getString(intakeDetails.billingAddress) ?? '',
      shippingAddress: this.getString(intakeDetails.shippingAddress) ?? '',
      shippingVendor: 'LTL',
      deliveryTimeline: '7-8 Business Days',
      itemDescription: order.partDescription,
      vehiclePartDescription: this.buildVehiclePartDescription(order),
      quantity: order.quantity,
      saleAmount: Number(order.totalSaleAmount),
      paymentStatus: '',
      paymentDate: '',
      paymentSource: '',
      shippingCost: 0,
      salesTaxes: 0,
      coreCharge: 0,
      totalAmount: Number(order.totalSaleAmount),
      customerSignature: '',
      customerSignatureImage: '',
      signatureDate: '',
    };
  }

  async findByOrderId(orderId: string, user: AuthenticatedUser) {
    const invoice = await this.invoicesRepository.findByOrderId(orderId, user);

    if (!invoice) {
      throw new NotFoundException('Invoice was not found.');
    }

    return this.serializeInvoice(invoice);
  }

  async create(
    orderId: string,
    createInvoiceDto: CreateInvoiceDto,
    user: AuthenticatedUser,
  ) {
    const order = await this.invoicesRepository.findAccessibleOrder(orderId, user);
    this.assertOrderCanGenerateInvoice(order);

    const existingInvoice = await this.invoicesRepository.findByOrderId(
      orderId,
      user,
    );

    if (existingInvoice) {
      throw new ConflictException('This order already has an invoice.');
    }

    const totalAmount = this.calculateTotalAmount(createInvoiceDto);

    const invoice = await this.invoicesRepository.create({
      orderId,
      invoiceNumber: createInvoiceDto.invoiceNumber.trim(),
      invoiceDate: this.parseDate(createInvoiceDto.invoiceDate),
      salesAssistant: this.optionalText(createInvoiceDto.salesAssistant),
      customerName: createInvoiceDto.customerName.trim(),
      contactNumber: this.optionalText(createInvoiceDto.contactNumber),
      billingAddress: this.optionalText(createInvoiceDto.billingAddress),
      shippingAddress: this.optionalText(createInvoiceDto.shippingAddress),
      shippingVendor: createInvoiceDto.shippingVendor.trim(),
      deliveryTimeline: createInvoiceDto.deliveryTimeline.trim(),
      itemDescription: createInvoiceDto.itemDescription.trim(),
      vehiclePartDescription: this.optionalText(
        createInvoiceDto.vehiclePartDescription,
      ),
      quantity: createInvoiceDto.quantity,
      saleAmount: new Prisma.Decimal(createInvoiceDto.saleAmount),
      paymentStatus: this.optionalText(createInvoiceDto.paymentStatus),
      paymentDate: createInvoiceDto.paymentDate
        ? this.parseDate(createInvoiceDto.paymentDate)
        : null,
      paymentSource: this.optionalText(createInvoiceDto.paymentSource),
      shippingCost: new Prisma.Decimal(createInvoiceDto.shippingCost),
      salesTaxes: new Prisma.Decimal(createInvoiceDto.salesTaxes),
      coreCharge: new Prisma.Decimal(createInvoiceDto.coreCharge),
      totalAmount: new Prisma.Decimal(totalAmount),
      customerSignature: this.optionalText(createInvoiceDto.customerSignature),
      signatureDate: createInvoiceDto.signatureDate
        ? this.parseDate(createInvoiceDto.signatureDate)
        : null,
      status: 'CREATED',
    });

    await this.notesService.create(
      {
        content: `Invoice generated: ${invoice.invoiceNumber}`,
        entityType: NoteEntityType.ORDER,
        entityId: orderId,
      },
      user,
    );

    if (order.customerEmail && this.invoiceMailService.isConfigured()) {
      return this.issueSignatureRequest(invoice.id, user, {
        noteMessage: `Invoice signature request sent: ${invoice.invoiceNumber}`,
      });
    }

    return this.serializeInvoice(invoice);
  }

  async resendSignatureRequest(orderId: string, user: AuthenticatedUser) {
    const invoice = await this.findByOrderId(orderId, user);

    return this.issueSignatureRequest(invoice.id, user, {
      noteMessage: `Invoice signature request resent: ${invoice.invoiceNumber}`,
    });
  }

  async generateNewSigningLink(orderId: string, user: AuthenticatedUser) {
    const invoice = await this.findByOrderId(orderId, user);

    return this.issueSignatureRequest(invoice.id, user, {
      noteMessage: `New invoice signing link generated: ${invoice.invoiceNumber}`,
    });
  }

  async findBySigningToken(token: string) {
    const invoice = await this.findInvoiceForToken(token);
    this.assertTokenCanBeViewed(invoice);

    return {
      ...this.serializeInvoice(invoice),
      canSign: invoice.status !== SIGNED_INVOICE_STATUS,
    };
  }

  async signWithToken(
    token: string,
    signInvoiceDto: SignInvoiceDto,
    ipAddress?: string,
  ) {
    const invoice = await this.findInvoiceForToken(token);

    if (invoice.status === SIGNED_INVOICE_STATUS) {
      throw new ConflictException('This invoice has already been signed.');
    }

    this.assertTokenIsActive(invoice);

    const signedAt = new Date();
    const signedInvoice = await this.invoicesRepository.update(invoice.id, {
      customerSignature: signInvoiceDto.customerSignature.trim(),
      customerSignatureImage: signInvoiceDto.customerSignatureImage,
      signatureDate: signedAt,
      signedAt,
      signatureIpAddress: ipAddress,
      status: SIGNED_INVOICE_STATUS,
    });

    const customerEmail = signedInvoice.order.customerEmail;
    if (customerEmail && this.invoiceMailService.isConfigured()) {
      await this.invoiceMailService.sendSignedConfirmation(
        {
          invoiceNumber: signedInvoice.invoiceNumber,
          customerName: signedInvoice.customerName,
          customerEmail,
          signedAt,
          salesAssistant: signedInvoice.salesAssistant,
          contactNumber: signedInvoice.contactNumber,
          billingAddress: signedInvoice.billingAddress,
          shippingAddress: signedInvoice.shippingAddress,
          shippingVendor: signedInvoice.shippingVendor,
          deliveryTimeline: signedInvoice.deliveryTimeline,
          itemDescription: signedInvoice.itemDescription,
          vehiclePartDescription: signedInvoice.vehiclePartDescription,
          quantity: signedInvoice.quantity,
          saleAmount: Number(signedInvoice.saleAmount),
          paymentStatus: signedInvoice.paymentStatus,
          paymentDate: signedInvoice.paymentDate,
          paymentSource: signedInvoice.paymentSource,
          shippingCost: Number(signedInvoice.shippingCost),
          salesTaxes: Number(signedInvoice.salesTaxes),
          coreCharge: Number(signedInvoice.coreCharge),
          totalAmount: Number(signedInvoice.totalAmount),
          customerSignature: signedInvoice.customerSignature,
          customerSignatureImage: signedInvoice.customerSignatureImage,
          signatureDate: signedInvoice.signatureDate,
          signedInvoicePdfBase64: signInvoiceDto.signedInvoicePdfBase64,
        },
      );
    }

    return {
      ...this.serializeInvoice(signedInvoice),
      canSign: false,
    };
  }

  private calculateTotalAmount(createInvoiceDto: CreateInvoiceDto): number {
    const totalAmount =
      createInvoiceDto.saleAmount -
      createInvoiceDto.shippingCost -
      createInvoiceDto.salesTaxes -
      createInvoiceDto.coreCharge;

    if (totalAmount < 0) {
      throw new BadRequestException(
        'Total amount cannot be negative after charges are applied.',
      );
    }

    return Number(totalAmount.toFixed(2));
  }

  private assertOrderCanGenerateInvoice(order: { status: string }) {
    if (order.status === 'PARTIALLY_PAID') {
      throw new BadRequestException('This order is still partially paid.');
    }
  }

  private async issueSignatureRequest(
    invoiceId: string,
    user: AuthenticatedUser,
    options: { noteMessage: string },
  ) {
    const existingInvoice = await this.invoicesRepository.findById(invoiceId);

    if (!existingInvoice) {
      throw new NotFoundException('Invoice was not found.');
    }

    if (existingInvoice.status === SIGNED_INVOICE_STATUS) {
      throw new ConflictException('Signed invoices are read-only.');
    }

    const customerEmail = existingInvoice.order.customerEmail;
    if (!customerEmail) {
      throw new BadRequestException(
        'Customer email is required before sending an invoice signature request.',
      );
    }

    if (!this.invoiceMailService.isConfigured()) {
      throw new ServiceUnavailableException('SMTP email is not configured.');
    }

    const signatureToken = this.buildSignatureTokenUpdate();
    const invoice = await this.invoicesRepository.update(invoiceId, {
      ...signatureToken.data,
      status: SIGNATURE_REQUESTED_STATUS,
      signatureRequestedAt: new Date(),
      signatureLastSentAt: new Date(),
    });

    await this.invoiceMailService.sendSignatureRequest(
      {
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        customerEmail,
      },
      this.buildSigningUrl(signatureToken.token),
    );

    await this.notesService.create(
      {
        content: options.noteMessage,
        entityType: NoteEntityType.ORDER,
        entityId: invoice.orderId,
      },
      user,
    );

    return this.serializeInvoice(invoice);
  }

  private serializeInvoice<
    T extends {
      signatureTokenHash?: string | null;
      order?: unknown;
    },
  >(invoice: T) {
    const { signatureTokenHash: _signatureTokenHash, order: _order, ...safeInvoice } =
      invoice;

    return safeInvoice;
  }

  private buildSignatureTokenUpdate(): {
    token: string;
    data: Prisma.InvoiceUncheckedUpdateInput;
  } {
    const token = randomBytes(32).toString('hex');

    return {
      token,
      data: {
        signatureTokenHash: this.hashToken(token),
        signatureTokenExpiresAt: this.buildTokenExpiryDate(),
      },
    };
  }

  private async findInvoiceForToken(token: string) {
    const tokenHash = this.hashToken(token);
    const invoice = await this.invoicesRepository.findByTokenHash(tokenHash);

    if (!invoice) {
      throw new NotFoundException('Invoice signing link was not found.');
    }

    return invoice;
  }

  private assertTokenCanBeViewed(invoice: {
    status: string;
    signatureTokenExpiresAt: Date | null;
  }) {
    if (invoice.status === SIGNED_INVOICE_STATUS) {
      return;
    }

    this.assertTokenIsActive(invoice);
  }

  private assertTokenIsActive(invoice: { signatureTokenExpiresAt: Date | null }) {
    if (
      !invoice.signatureTokenExpiresAt ||
      invoice.signatureTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new GoneException('Invoice signing link has expired.');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildTokenExpiryDate(): Date {
    const ttlDays = this.configService.get<number>(
      'INVOICE_SIGNING_TOKEN_TTL_DAYS',
      30,
    );
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + ttlDays);

    return expiryDate;
  }

  private buildSigningUrl(token: string): string {
    const baseUrl = this.configService
      .get<string>('APP_BASE_URL', 'http://localhost:3001')
      .replace(/\/$/, '');

    return `${baseUrl}/invoice-sign/${token}`;
  }

  private buildVehiclePartDescription(order: InvoiceOrder): string {
    const intakeDetails = this.normalizeIntakeDetails(order.intakeDetails);
    const parts = [
      this.getString(intakeDetails.vehicleYear),
      this.getString(intakeDetails.vehicleMake),
      this.getString(intakeDetails.vehicleModel),
      this.getString(intakeDetails.vehicleVariant),
      this.getString(intakeDetails.vehicleConfiguration),
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' ') : order.partDescription;
  }

  private normalizeIntakeDetails(value: Prisma.JsonValue): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private getString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private optionalText(value?: string): string | null {
    if (!value) {
      return null;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private parseDate(value: string): Date {
    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Date value is invalid.');
    }

    return parsedDate;
  }

  private formatDateInputValue(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day}`;
  }
}
