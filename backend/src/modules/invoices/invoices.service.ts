import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NoteEntityType } from '../../common/enums/note-entity-type.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { NotesService } from '../notes/notes.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import {
  InvoiceOrder,
  InvoicesRepository,
} from './invoices.repository';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly invoicesRepository: InvoicesRepository,
    private readonly notesService: NotesService,
  ) {}

  async getDefaults(orderId: string, user: AuthenticatedUser) {
    const order = await this.invoicesRepository.findAccessibleOrder(orderId, user);
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
      signatureDate: '',
    };
  }

  async findByOrderId(orderId: string, user: AuthenticatedUser) {
    const invoice = await this.invoicesRepository.findByOrderId(orderId, user);

    if (!invoice) {
      throw new NotFoundException('Invoice was not found.');
    }

    return invoice;
  }

  async create(
    orderId: string,
    createInvoiceDto: CreateInvoiceDto,
    user: AuthenticatedUser,
  ) {
    await this.invoicesRepository.findAccessibleOrder(orderId, user);

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

    return invoice;
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
