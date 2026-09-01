import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { NoteEntityType } from '../../common/enums/note-entity-type.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { getPacificTodayDateInputValue } from '../../common/utils/pacific-date.util';
import { NotesService } from '../notes/notes.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { SignInvoiceDto } from './dto/sign-invoice.dto';
import { InvoiceMailService } from './invoice-mail.service';
import {
  InvoiceOrder,
  InvoicesRepository,
} from './invoices.repository';
import { RingCentralSmsService } from './ringcentral-sms.service';

const SIGNED_INVOICE_STATUS = 'SIGNED';
const SIGNATURE_REQUESTED_STATUS = 'SIGNATURE_REQUESTED';
const SIGNATURE_SMS_SENT = 'SENT';
const SIGNATURE_SMS_SKIPPED = 'SKIPPED';
const SIGNATURE_SMS_FAILED = 'FAILED';
const AUDIT_DOCUMENT_TITLE = 'Photo ID - Front copy';
const DEFAULT_WARRANTY_PARTS_ONLY = [
  'Standard: 90 days for non-performance engines and transmissions.',
  "No Warranty: Rotary engines, engine accessories (alternator, turbocharger, sensors), and labor - any accesories sent isn't charged or covered.",
  'Voided Warranty: Overheating, abuse, improper installation, or failure to install a new timing belt/tensioner and/or accesories.',
  'Coverage: Engines are guaranteed against rod knock, cracked blocks, and internal issues.',
  'Warranty is void if the part requires modifications to fit or if it necessitates alterations or replacement of other components.',
].join('\n');
const DEFAULT_CANCELLATION_POLICY =
  'Cancellation request after payment confirmation will have standard 25% restocking fee remainder will be refunded to the source payment method except wire payments, also additional shipping charges will apply for any requests post 24 hrs from payment confirmation.';

type InvoiceAuditActor = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type InvoiceAuditSource = {
  customerName?: string | null;
  contactNumber?: string | null;
  order?: {
    customerEmail?: string | null;
    customerPhone?: string | null;
    currency?: string | null;
  } | null;
};

type InvoiceAuditEventRecord = {
  id: string;
  eventType: string;
  title: string;
  description: string;
  actorName: string | null;
  actorEmail: string | null;
  actorPhone: string | null;
  ipAddress: string | null;
  metadata: Prisma.JsonValue | null;
  occurredAt: Date;
  createdAt: Date;
};

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly invoicesRepository: InvoicesRepository,
    private readonly invoiceMailService: InvoiceMailService,
    private readonly ringCentralSmsService: RingCentralSmsService,
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
      invoiceDate: getPacificTodayDateInputValue(),
      salesAssistant,
      customerName: order.customerName,
      contactNumber:
        this.getString(intakeDetails.billingPhone) ??
        this.getString(intakeDetails.shippingPhone) ??
        order.customerPhone ??
        '',
      billingAddress: this.getString(intakeDetails.billingAddress) ?? '',
      shippingAddress: this.formatShippingAddress(
        this.getString(intakeDetails.companyName),
        this.getString(intakeDetails.shippingAddress),
      ),
      shippingVendor: 'LTL',
      deliveryTimeline: '7-8 Business Days',
      itemDescription: order.partDescription,
      vehiclePartDescription: this.buildVehiclePartDescription(order),
      warrantyPartsOnly: DEFAULT_WARRANTY_PARTS_ONLY,
      cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
      quantity: order.quantity,
      saleAmount: Number(order.totalSaleAmount),
      currency: this.normalizeCurrency(order.currency),
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
      photoIdRequired: true,
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
    ipAddress?: string,
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
      warrantyPartsOnly:
        this.optionalText(createInvoiceDto.warrantyPartsOnly) ??
        DEFAULT_WARRANTY_PARTS_ONLY,
      cancellationPolicy:
        this.optionalText(createInvoiceDto.cancellationPolicy) ??
        DEFAULT_CANCELLATION_POLICY,
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
      photoIdRequired: true,
      status: 'CREATED',
    });

    await this.createAuditEvent(invoice.id, 'CREATED', {
      actor: this.userToAuditActor(user),
      description: `${user.name} generated invoice ${invoice.invoiceNumber}.`,
      ipAddress,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
      },
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
        ipAddress,
      });
    }

    return this.findByOrderId(orderId, user);
  }

  async update(
    orderId: string,
    createInvoiceDto: CreateInvoiceDto,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const existingInvoice = await this.invoicesRepository.findByOrderId(
      orderId,
      user,
    );

    if (!existingInvoice) {
      throw new NotFoundException('Invoice was not found.');
    }

    if (existingInvoice.status === SIGNED_INVOICE_STATUS) {
      throw new ConflictException('Signed invoices are read-only.');
    }

    const totalAmount = this.calculateTotalAmount(createInvoiceDto);
    const invoice = await this.invoicesRepository.update(existingInvoice.id, {
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
      warrantyPartsOnly:
        this.optionalText(createInvoiceDto.warrantyPartsOnly) ??
        DEFAULT_WARRANTY_PARTS_ONLY,
      cancellationPolicy:
        this.optionalText(createInvoiceDto.cancellationPolicy) ??
        DEFAULT_CANCELLATION_POLICY,
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
      photoIdRequired: true,
    });

    await this.notesService.create(
      {
        content: `Invoice updated: ${invoice.invoiceNumber}`,
        entityType: NoteEntityType.ORDER,
        entityId: orderId,
      },
      user,
    );

    await this.createAuditEvent(invoice.id, 'EDITED', {
      actor: this.userToAuditActor(user),
      description: `${user.name} (${user.email}) made edits to the document.`,
      ipAddress,
    });

    return this.findByOrderId(orderId, user);
  }

  async resendSignatureRequest(
    orderId: string,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const invoice = await this.findByOrderId(orderId, user);

    return this.issueSignatureRequest(invoice.id, user, {
      noteMessage: `Invoice signature request resent: ${invoice.invoiceNumber}`,
      ipAddress,
    });
  }

  async generateNewSigningLink(
    orderId: string,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const invoice = await this.findByOrderId(orderId, user);

    return this.issueSignatureRequest(invoice.id, user, {
      noteMessage: `New invoice signing link generated: ${invoice.invoiceNumber}`,
      ipAddress,
    });
  }

  async cloneSignedInvoice(
    orderId: string,
    createInvoiceDto: CreateInvoiceDto,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    const invoice = await this.findByOrderId(orderId, user);

    if (invoice.status !== SIGNED_INVOICE_STATUS) {
      throw new ConflictException('Only signed invoices can be cloned.');
    }

    const totalAmount = this.calculateTotalAmount(createInvoiceDto);
    const resetInvoice = await this.invoicesRepository.update(invoice.id, {
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
      warrantyPartsOnly:
        this.optionalText(createInvoiceDto.warrantyPartsOnly) ??
        DEFAULT_WARRANTY_PARTS_ONLY,
      cancellationPolicy:
        this.optionalText(createInvoiceDto.cancellationPolicy) ??
        DEFAULT_CANCELLATION_POLICY,
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
      customerSignature: null,
      customerSignatureImage: null,
      signatureDate: null,
      photoIdRequired: true,
      photoIdDocument: null,
      photoIdFileName: null,
      photoIdMimeType: null,
      photoIdUploadedAt: null,
      signedAt: null,
      signatureIpAddress: null,
      signatureTokenHash: null,
      signatureTokenExpiresAt: null,
      signatureRequestedAt: null,
      signatureLastSentAt: null,
      status: 'CREATED',
      pdfStorageKey: null,
    });

    await this.createAuditEvent(resetInvoice.id, 'CLONED', {
      actor: this.userToAuditActor(user),
      description: `${user.name} cloned the signed invoice, reviewed copied details, and reinitiated the signing process.`,
      ipAddress,
    });

    return this.issueSignatureRequest(resetInvoice.id, user, {
      noteMessage: `Signed invoice cloned and signature request sent: ${resetInvoice.invoiceNumber}`,
      ipAddress,
    });
  }

  async findBySigningToken(token: string, ipAddress?: string) {
    const invoice = await this.findInvoiceForToken(token);
    this.assertTokenCanBeViewed(invoice);

    await this.createAuditEvent(invoice.id, 'VIEWED', {
      actor: this.customerToAuditActor(invoice),
      description: `${this.describeCustomer(invoice)} viewed the document.`,
      ipAddress,
    });

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

    if (!this.hasAcceptedTermsForCurrentInvoice(invoice)) {
      throw new BadRequestException(
        'Terms & Conditions must be accepted before signing.',
      );
    }

    if (!signInvoiceDto.photoIdDocument) {
      throw new BadRequestException('Photo ID is required before signing.');
    }

    const signedAt = new Date();
    const signedInvoice = await this.invoicesRepository.update(invoice.id, {
      customerSignature: signInvoiceDto.customerSignature.trim(),
      customerSignatureImage: signInvoiceDto.customerSignatureImage,
      signatureDate: signedAt,
      photoIdDocument: signInvoiceDto.photoIdDocument ?? null,
      photoIdFileName: this.optionalText(signInvoiceDto.photoIdFileName),
      photoIdMimeType: this.optionalText(signInvoiceDto.photoIdMimeType),
      photoIdUploadedAt: signInvoiceDto.photoIdDocument ? signedAt : null,
      signedAt,
      signatureIpAddress: ipAddress,
      status: SIGNED_INVOICE_STATUS,
    });

    if (signInvoiceDto.photoIdDocument) {
      await this.createAuditEvent(signedInvoice.id, 'ATTACHED', {
        actor: this.customerToAuditActor(signedInvoice),
        description: `${this.describeCustomer(signedInvoice)} attached ${AUDIT_DOCUMENT_TITLE}.`,
        ipAddress,
        metadata: {
          documentTitle: AUDIT_DOCUMENT_TITLE,
          fileName: signedInvoice.photoIdFileName,
          mimeType: signedInvoice.photoIdMimeType,
          hash: this.hashDocument(signInvoiceDto.photoIdDocument),
        },
      });
    }

    await this.createAuditEvent(signedInvoice.id, 'SIGNED', {
      actor: this.customerToAuditActor(signedInvoice),
      description: `${this.describeCustomer(signedInvoice)} signed the document.`,
      ipAddress,
    });

    await this.createAuditEvent(signedInvoice.id, 'COMPLETED', {
      description: 'Document has been completed.',
      ipAddress,
    });

    const customerEmail = signedInvoice.order.customerEmail;
    if (customerEmail && this.invoiceMailService.isConfigured()) {
      await this.invoiceMailService.sendSignedConfirmation(
        {
          invoiceNumber: signedInvoice.invoiceNumber,
          invoiceDate: signedInvoice.invoiceDate,
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
          warrantyPartsOnly:
            signedInvoice.warrantyPartsOnly ?? DEFAULT_WARRANTY_PARTS_ONLY,
          cancellationPolicy:
            signedInvoice.cancellationPolicy ?? DEFAULT_CANCELLATION_POLICY,
          quantity: signedInvoice.quantity,
          saleAmount: Number(signedInvoice.saleAmount),
          currency: this.normalizeCurrency(signedInvoice.order.currency),
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

    const refreshedInvoice =
      (await this.invoicesRepository.findById(signedInvoice.id)) ??
      signedInvoice;

    return {
      ...this.serializeInvoice(refreshedInvoice),
      canSign: false,
    };
  }

  async acceptTermsWithToken(token: string, ipAddress?: string) {
    const invoice = await this.findInvoiceForToken(token);

    if (invoice.status === SIGNED_INVOICE_STATUS) {
      throw new ConflictException('This invoice has already been signed.');
    }

    this.assertTokenIsActive(invoice);

    const hasAcceptedTerms = this.hasAcceptedTermsForCurrentInvoice(invoice);

    if (!hasAcceptedTerms) {
      await this.createAuditEvent(invoice.id, 'TERMS_ACCEPTED', {
        actor: this.customerToAuditActor(invoice),
        description: `${this.describeCustomer(invoice)} agreed to Terms & Conditions - Warranty | Returns | Cancellation.`,
        ipAddress,
        metadata: {
          agreement:
            'Terms & Conditions - Warranty | Returns | Cancellation',
          checkboxText:
            'I have read and agreed Terms & Conditions - Warranty | Returns | Cancellation',
        },
      });
    }

    const refreshedInvoice =
      (await this.invoicesRepository.findById(invoice.id)) ?? invoice;

    return {
      ...this.serializeInvoice(refreshedInvoice),
      canSign: true,
    };
  }

  private calculateTotalAmount(createInvoiceDto: CreateInvoiceDto): number {
    const totalAmount =
      createInvoiceDto.saleAmount +
      createInvoiceDto.shippingCost +
      createInvoiceDto.salesTaxes +
      createInvoiceDto.coreCharge;

    return Number(totalAmount.toFixed(2));
  }

  private formatShippingAddress(
    businessName?: string | null,
    businessAddress?: string | null,
  ): string {
    return [businessName, businessAddress]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join('\n');
  }

  private assertOrderCanGenerateInvoice(order: { status: string }) {
    if (order.status === 'PARTIALLY_PAID') {
      throw new BadRequestException('This order is still partially paid.');
    }
  }

  private async issueSignatureRequest(
    invoiceId: string,
    user: AuthenticatedUser,
    options: { noteMessage: string; ipAddress?: string },
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
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.order.currency,
        signatureTokenExpiresAt: invoice.signatureTokenExpiresAt,
      },
      this.buildSigningUrl(signatureToken.token),
    );

    const signatureSmsResult = await this.sendSignatureRequestSms(
      {
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        contactNumber: invoice.contactNumber,
        orderCustomerPhone: invoice.order.customerPhone,
      },
      this.buildSigningUrl(signatureToken.token),
    );

    await this.createAuditEvent(invoice.id, 'SENT', {
      actor: this.userToAuditActor(user),
      description: `MEEHIKAA AUTO PARTS INC sent the document to ${this.describeCustomer(invoice)}.`,
      ipAddress: options.ipAddress,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        recipientEmail: customerEmail,
        recipientPhone: invoice.contactNumber ?? invoice.order.customerPhone,
        smsStatus: signatureSmsResult.status,
        smsMessage: signatureSmsResult.message,
      },
    });

    await this.notesService.create(
      {
        content: options.noteMessage,
        entityType: NoteEntityType.ORDER,
        entityId: invoice.orderId,
      },
      user,
    );

    const refreshedInvoice =
      (await this.invoicesRepository.findById(invoice.id)) ?? invoice;

    return {
      ...this.serializeInvoice(refreshedInvoice),
      signatureSmsStatus: signatureSmsResult.status,
      signatureSmsMessage: signatureSmsResult.message,
    };
  }

  private async sendSignatureRequestSms(
    invoice: {
      invoiceNumber: string;
      customerName: string;
      contactNumber: string | null;
      orderCustomerPhone: string | null;
    },
    signingUrl: string,
  ): Promise<{ status: string; message: string }> {
    const phoneNumber = invoice.contactNumber ?? invoice.orderCustomerPhone;

    if (!phoneNumber) {
      return {
        status: SIGNATURE_SMS_SKIPPED,
        message: 'no phone number',
      };
    }

    if (!this.ringCentralSmsService.isConfigured()) {
      return {
        status: SIGNATURE_SMS_SKIPPED,
        message: 'SMS is not configured',
      };
    }

    try {
      await this.ringCentralSmsService.sendInvoiceSignatureLink({
        to: phoneNumber,
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
        signingUrl,
      });

      return {
        status: SIGNATURE_SMS_SENT,
        message: 'SMS sent',
      };
    } catch (error) {
      this.logger.warn(
        `Invoice signature SMS failed for ${invoice.invoiceNumber}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );

      return {
        status: SIGNATURE_SMS_FAILED,
        message: 'check logs/RingCentral',
      };
    }
  }

  private serializeInvoice<
    T extends {
      signatureTokenHash?: string | null;
      order?: {
        currency?: string | null;
      } | null;
      auditEvents?: InvoiceAuditEventRecord[];
      photoIdDocument?: string | null;
      photoIdFileName?: string | null;
      photoIdMimeType?: string | null;
      photoIdUploadedAt?: Date | null;
      signatureRequestedAt?: Date | null;
      signatureLastSentAt?: Date | null;
      signedAt?: Date | null;
      signatureIpAddress?: string | null;
      invoiceDate?: Date;
      paymentDate?: Date | null;
      signatureDate?: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
    },
  >(invoice: T) {
    const safeInvoice = { ...invoice };
    delete safeInvoice.signatureTokenHash;
    delete safeInvoice.order;
    delete safeInvoice.auditEvents;

    return {
      ...safeInvoice,
      photoIdRequired: true,
      ...(invoice.invoiceDate
        ? { invoiceDate: this.formatDateOnlyValue(invoice.invoiceDate) }
        : {}),
      ...(invoice.paymentDate !== undefined
        ? {
            paymentDate: invoice.paymentDate
              ? this.formatDateOnlyValue(invoice.paymentDate)
              : null,
          }
        : {}),
      ...(invoice.signatureDate !== undefined
        ? {
            signatureDate: invoice.signatureDate
              ? this.formatDateOnlyValue(invoice.signatureDate)
              : null,
          }
        : {}),
      currency: this.normalizeCurrency(invoice.order?.currency),
      auditTrail: this.buildAuditTrail(invoice),
    };
  }

  private normalizeCurrency(currency?: string | null): 'USD' | 'CAD' {
    return currency === 'CAD' ? 'CAD' : 'USD';
  }

  private async createAuditEvent(
    invoiceId: string,
    eventType: string,
    options: {
      actor?: InvoiceAuditActor;
      description: string;
      ipAddress?: string;
      metadata?: Prisma.JsonObject;
      occurredAt?: Date;
    },
  ) {
    await this.invoicesRepository.createAuditEvent({
      invoiceId,
      eventType,
      title: this.auditTitle(eventType),
      description: options.description,
      actorName: options.actor?.name ?? null,
      actorEmail: options.actor?.email ?? null,
      actorPhone: options.actor?.phone ?? null,
      ipAddress: options.ipAddress ?? null,
      metadata: options.metadata ?? Prisma.JsonNull,
      occurredAt: options.occurredAt ?? new Date(),
    });
  }

  private buildAuditTrail<
    T extends {
      auditEvents?: InvoiceAuditEventRecord[];
      photoIdDocument?: string | null;
      photoIdFileName?: string | null;
      photoIdMimeType?: string | null;
      photoIdUploadedAt?: Date | null;
      signatureRequestedAt?: Date | null;
      signatureLastSentAt?: Date | null;
      signedAt?: Date | null;
      signatureIpAddress?: string | null;
      createdAt?: Date;
      updatedAt?: Date;
    },
  >(invoice: T) {
    const storedEvents = invoice.auditEvents ?? [];
    const storedEventTypes = new Set(storedEvents.map((event) => event.eventType));
    const events = this.buildFallbackAuditEvents(invoice)
      .filter((event) => !storedEventTypes.has(event.eventType))
      .concat(storedEvents);
    const uniqueEvents = new Map<string, InvoiceAuditEventRecord>();

    for (const event of events) {
      uniqueEvents.set(event.id, event);
    }

    const sortedEvents = Array.from(uniqueEvents.values()).sort(
      (firstEvent, secondEvent) =>
        secondEvent.occurredAt.getTime() - firstEvent.occurredAt.getTime(),
    );

    const timestamps = sortedEvents
      .filter((event) =>
        ['SIGNED', 'VIEWED', 'SENT', 'TERMS_ACCEPTED'].includes(
          event.eventType,
        ),
      )
      .map((event) => ({
        label: this.auditTitle(event.eventType),
        occurredAt: event.occurredAt,
      }));

    return {
      timestamps,
      attachmentDetails: invoice.photoIdDocument
        ? {
            documentTitle: AUDIT_DOCUMENT_TITLE,
            fileName: invoice.photoIdFileName,
            mimeType: invoice.photoIdMimeType,
            uploadedAt: invoice.photoIdUploadedAt,
            hash: this.hashDocument(invoice.photoIdDocument),
          }
        : null,
      events: sortedEvents,
    };
  }

  private buildFallbackAuditEvents<
    T extends {
      photoIdDocument?: string | null;
      photoIdUploadedAt?: Date | null;
      signatureRequestedAt?: Date | null;
      signatureLastSentAt?: Date | null;
      signedAt?: Date | null;
      signatureIpAddress?: string | null;
      createdAt?: Date;
    },
  >(invoice: T): InvoiceAuditEventRecord[] {
    const fallbackEvents: InvoiceAuditEventRecord[] = [];

    if (invoice.createdAt) {
      fallbackEvents.push(
        this.buildFallbackAuditEvent('CREATED', invoice.createdAt, 'Invoice was generated.'),
      );
    }

    const sentAt = invoice.signatureLastSentAt ?? invoice.signatureRequestedAt;
    if (sentAt) {
      fallbackEvents.push(
        this.buildFallbackAuditEvent('SENT', sentAt, 'Signature request was sent.'),
      );
    }

    if (invoice.photoIdDocument && invoice.photoIdUploadedAt) {
      fallbackEvents.push(
        this.buildFallbackAuditEvent(
          'ATTACHED',
          invoice.photoIdUploadedAt,
          `${AUDIT_DOCUMENT_TITLE} was attached.`,
          invoice.signatureIpAddress,
        ),
      );
    }

    if (invoice.signedAt) {
      fallbackEvents.push(
        this.buildFallbackAuditEvent(
          'SIGNED',
          invoice.signedAt,
          'Document was signed.',
          invoice.signatureIpAddress,
        ),
      );
      fallbackEvents.push(
        this.buildFallbackAuditEvent(
          'COMPLETED',
          invoice.signedAt,
          'Document has been completed.',
          invoice.signatureIpAddress,
        ),
      );
    }

    return fallbackEvents;
  }

  private buildFallbackAuditEvent(
    eventType: string,
    occurredAt: Date,
    description: string,
    ipAddress?: string | null,
  ): InvoiceAuditEventRecord {
    return {
      id: `fallback-${eventType}-${occurredAt.toISOString()}`,
      eventType,
      title: this.auditTitle(eventType),
      description,
      actorName: null,
      actorEmail: null,
      actorPhone: null,
      ipAddress: ipAddress ?? null,
      metadata: null,
      occurredAt,
      createdAt: occurredAt,
    };
  }

  private auditTitle(eventType: string): string {
    const titles: Record<string, string> = {
      CREATED: 'Created',
      SENT: 'Sent',
      EDITED: 'Edited',
      VIEWED: 'Viewed',
      ATTACHED: 'Attached',
      TERMS_ACCEPTED: 'Terms Accepted',
      SIGNED: 'Signed',
      COMPLETED: 'Completed',
      CLONED: 'Cloned',
    };

    return titles[eventType] ?? eventType;
  }

  private hasAcceptedTermsForCurrentInvoice(invoice: {
    auditEvents?: InvoiceAuditEventRecord[];
  }): boolean {
    const acceptedAt = this.getLatestAuditEventTimestamp(
      invoice.auditEvents,
      'TERMS_ACCEPTED',
    );

    if (!acceptedAt) {
      return false;
    }

    const editedAt = this.getLatestAuditEventTimestamp(
      invoice.auditEvents,
      'EDITED',
    );

    return !editedAt || acceptedAt >= editedAt;
  }

  private getLatestAuditEventTimestamp(
    auditEvents: InvoiceAuditEventRecord[] | undefined,
    eventType: string,
  ): number | null {
    const timestamps = (auditEvents ?? [])
      .filter((event) => event.eventType === eventType)
      .map((event) => event.occurredAt.getTime())
      .filter((timestamp) => Number.isFinite(timestamp));

    return timestamps.length ? Math.max(...timestamps) : null;
  }

  private userToAuditActor(user: AuthenticatedUser): InvoiceAuditActor {
    return {
      name: user.name,
      email: user.email,
    };
  }

  private customerToAuditActor(invoice: InvoiceAuditSource): InvoiceAuditActor {
    return {
      name: invoice.customerName,
      email: invoice.order?.customerEmail,
      phone: invoice.contactNumber ?? invoice.order?.customerPhone,
    };
  }

  private describeCustomer(invoice: InvoiceAuditSource): string {
    const actor = this.customerToAuditActor(invoice);
    const channels = [actor.email, actor.phone].filter(Boolean).join(' / ');

    return channels ? `${actor.name ?? 'Customer'} (${channels})` : actor.name ?? 'Customer';
  }

  private hashDocument(documentData: string): string {
    return createHash('sha256').update(documentData).digest('hex');
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
    const ttlDays = Number(
      this.configService.get<string>('INVOICE_SIGNING_TOKEN_TTL_DAYS') ?? 30,
    );
    const expiryDate = new Date();
    expiryDate.setDate(
      expiryDate.getDate() + (Number.isFinite(ttlDays) ? ttlDays : 30),
    );

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
    const trimmedValue = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      const [year, month, day] = trimmedValue.split('-').map(Number);
      const parsedDate = new Date(Date.UTC(year, month - 1, day, 12));

      if (
        parsedDate.getUTCFullYear() !== year ||
        parsedDate.getUTCMonth() !== month - 1 ||
        parsedDate.getUTCDate() !== day
      ) {
        throw new BadRequestException('Date value is invalid.');
      }

      return parsedDate;
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Date value is invalid.');
    }

    return parsedDate;
  }

  private formatDateOnlyValue(date: Date): string {
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${date.getUTCFullYear()}-${month}-${day}`;
  }
}
