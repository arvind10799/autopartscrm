import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { join } from 'path';
import PDFDocument from 'pdfkit';

type MailInvoice = {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  signedAt?: Date | null;
};

type SignedMailInvoice = MailInvoice & {
  salesAssistant?: string | null;
  contactNumber?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  shippingVendor: string;
  deliveryTimeline: string;
  itemDescription: string;
  vehiclePartDescription?: string | null;
  quantity: number;
  saleAmount: number;
  paymentStatus?: string | null;
  paymentDate?: Date | null;
  paymentSource?: string | null;
  shippingCost: number;
  salesTaxes: number;
  coreCharge: number;
  totalAmount: number;
  customerSignature?: string | null;
  customerSignatureImage?: string | null;
  signatureDate?: Date | null;
  signedInvoicePdfBase64?: string;
};

@Injectable()
export class InvoiceMailService {
  private readonly logger = new Logger(InvoiceMailService.name);
  private readonly transporter: Transporter | null;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<number>('SMTP_PORT', 587) === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  isConfigured(): boolean {
    return Boolean(this.transporter);
  }

  async sendSignatureRequest(invoice: MailInvoice, signingUrl: string) {
    await this.sendMail({
      to: invoice.customerEmail,
      subject: `Invoice #${invoice.invoiceNumber} - Signature Required`,
      html: `
        <p>Hello ${this.escapeHtml(invoice.customerName)},</p>
        <p>Thank you for choosing MEE Auto Parts.</p>
        <p>Your invoice is ready.</p>
        <p>Please review and electronically sign the invoice using the secure link below.</p>
        <p>
          <a href="${this.escapeHtml(signingUrl)}" style="display:inline-block;background:#f26b2f;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700;">
            Review &amp; Sign Invoice
          </a>
        </p>
        <p>This link is secure and can only be used for this invoice.</p>
        <p>Thank you,<br />MEE Auto Parts</p>
      `,
      text: [
        `Hello ${invoice.customerName},`,
        '',
        'Thank you for choosing MEE Auto Parts.',
        '',
        'Your invoice is ready.',
        '',
        'Please review and electronically sign the invoice using the secure link below.',
        '',
        signingUrl,
        '',
        'This link is secure and can only be used for this invoice.',
        '',
        'Thank you,',
        'MEE Auto Parts',
      ].join('\n'),
    });
  }

  async sendSignedConfirmation(invoice: SignedMailInvoice) {
    const signedInvoicePdf =
      this.parsePdfDataUrl(invoice.signedInvoicePdfBase64) ??
      (await this.buildSignedInvoicePdf(invoice));

    await this.sendMail({
      to: invoice.customerEmail,
      subject: 'Invoice Successfully Signed',
      html: `
        <p>Thank you.</p>
        <p>Your signed invoice has been received.</p>
        <p>A copy of the signed invoice is attached.</p>
        <p>MEE Auto Parts</p>
      `,
      text: [
        'Thank you.',
        '',
        'Your signed invoice has been received.',
        '',
        'A copy of the signed invoice is attached.',
        '',
        'MEE Auto Parts',
      ].join('\n'),
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber}-signed.pdf`,
          content: signedInvoicePdf,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  private async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    attachments?: Array<{
      filename: string;
      content: string | Buffer;
      contentType: string;
    }>;
  }) {
    if (!this.transporter) {
      this.logger.warn('SMTP is not configured. Invoice email was not sent.');
      throw new ServiceUnavailableException('SMTP email is not configured.');
    }

    await this.transporter.sendMail({
      from: this.configService.get<string>(
        'MAIL_FROM',
        'MEE Auto Parts Billing <billing@meeautoparts.com>',
      ),
      ...options,
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  private buildSignedInvoicePdf(invoice: SignedMailInvoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({
        autoFirstPage: false,
        margins: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
        size: 'A4',
      });
      const chunks: Buffer[] = [];

      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      this.drawPurchaseInvoicePage(document, invoice);
      this.drawWarrantyPage(document, invoice);

      document.end();
    });
  }

  private drawPurchaseInvoicePage(
    document: PDFKit.PDFDocument,
    invoice: SignedMailInvoice,
  ) {
    this.startInvoicePage(document, 'PURCHASE INVOICE', invoice, true);

    const left = 30;
    const right = 565;

    document
      .fontSize(11)
      .fillColor('#56575c')
      .font('Helvetica-Bold')
      .text('Shipping Address:', left + 10, 138)
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#111827')
      .text(invoice.shippingAddress ?? '', left + 116, 139, { width: 168 });

    document
      .fontSize(11)
      .fillColor('#56575c')
      .font('Helvetica-Bold')
      .text('Shipping Vendor:', left + 10, 210)
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#111827')
      .text(invoice.shippingVendor || 'LTL', 280, 211, { width: 40, align: 'right' });

    document
      .moveTo(309, 160)
      .lineTo(309, 252)
      .lineWidth(1.5)
      .strokeColor('#9c9c9c')
      .stroke();

    this.drawLabelValue(document, 'Customer Name:', invoice.customerName, 330, 138);
    this.drawLabelValue(document, 'Billing Address:', invoice.billingAddress, 330, 158);
    this.drawLabelValue(document, 'Contact Number:', invoice.contactNumber, 330, 222);

    document
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#67686d')
      .text(
        `Delivery timeline is ${invoice.deliveryTimeline}, may vary due to distance and shipping vendor`,
        left,
        270,
      )
      .moveTo(left, 290)
      .lineTo(right, 290)
      .lineWidth(2)
      .strokeColor('#9c9c9c')
      .stroke();

    this.drawRoundedBox(document, left, 300, 535, 96);
    document
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#5b5c62')
      .text('Item Descriptions', left + 12, 310)
      .text('Qty', 405, 310, { width: 42, align: 'center' })
      .text('Amount', 486, 310, { width: 56, align: 'center' });

    document
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#111827')
      .text(invoice.itemDescription, left + 12, 338)
      .text(invoice.vehiclePartDescription ?? '', left + 12, 362, { width: 300 })
      .text(String(invoice.quantity), 405, 338, { width: 42, align: 'center' })
      .text(this.formatMoney(invoice.saleAmount), 486, 338, {
        width: 56,
        align: 'center',
      });

    this.drawRoundedBox(document, left, 406, 535, 106);
    document
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#56575c')
      .text('Payment Status:', left + 12, 418)
      .text('Date:', left + 12, 432)
      .text('Payment Source:', left + 12, 446)
      .font('Helvetica')
      .fillColor('#111827')
      .text(invoice.paymentStatus ?? '', left + 92, 418)
      .text(invoice.paymentDate ? this.formatDate(invoice.paymentDate) : '', left + 92, 432)
      .text(invoice.paymentSource ?? '', left + 92, 446);

    document
      .fontSize(8.5)
      .fillColor('#ff1f28')
      .text('Additional charges will be applicable :', left + 12, 470, {
        underline: true,
      })
      .fontSize(6.5)
      .fillColor('#56575c')
      .text('• If ', left + 18, 492, { continued: true })
      .fillColor('#ff1f28')
      .text('unloading equipment', { continued: true })
      .fillColor('#56575c')
      .text(' is unavailable at the time of delivery ( Freight’s only)')
      .text('• ', left + 18, 506, { continued: true })
      .fillColor('#ff1f28')
      .text('Reschedule delivery', { continued: true })
      .fillColor('#56575c')
      .text(' ( Missed or reattempt delivery )');

    this.drawChargeLine(document, 'Shipping Cost', invoice.shippingCost, 388, 418);
    this.drawChargeLine(document, 'Sales Taxes', invoice.salesTaxes, 388, 434);
    this.drawChargeLine(document, 'Core Charge', invoice.coreCharge, 388, 450);
    document
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#4f5056')
      .text('TOTAL', 390, 486)
      .fontSize(8)
      .fillColor('#111827')
      .text(this.formatMoney(invoice.totalAmount), 500, 488);

    this.drawSignature(document, invoice);
    this.drawFooter(document);
  }

  private drawWarrantyPage(
    document: PDFKit.PDFDocument,
    invoice: SignedMailInvoice,
  ) {
    this.startInvoicePage(document, 'WARRANTY - TERMS & CONDITION', invoice, false);

    const x = 40;
    let y = 178;
    document
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#55565b')
      .text('Warranty | Returns | Cancellation', x, y);

    y += 44;
    y = this.drawWarrantySection(document, x, y, 'Warranty ( parts only )', [
      'Standard: 90 days for non-performance engines and transmissions.',
      'No Warranty: Rotary engines, engine accessories (alternator, turbocharger, sensors), and labor - any accesories sent isn’t charged or covered.',
      'Voided Warranty: Overheating, abuse, improper installation, or failure to install a new timing belt/tensioner and/or accesories.',
      'Coverage: Engines are guaranteed against rod knock, cracked blocks, and internal issues.',
      'Warranty is void if the part requires modifications to fit or if it necessitates alterations or replacement of other components.',
    ]);
    y = this.drawWarrantySection(document, x, y + 12, 'Installation & Returns', [
      'Installation: Engines and transmissions must be installed within 15 days from the day of delivery by a licensed professional at a licensed repair facility, following manufacturer guidelines.',
      'All parts must be installed within 15 days of delivery. Failure to complete the installation within this timeframe will void any warranty claims.',
      'Defective Parts: MEE Auto Parts will exchange defective parts or issue a refund only if the part is out of stock.',
      'Returns: Parts must be returned in their original condition.',
    ]);
    y = this.drawWarrantySection(document, x, y + 12, 'Cancellation', [
      'Cancellation request after payment confirmation will have standard 25% restocking fee remainder will be refunded to the source payment method except wire payments, also additional shipping charges will apply for any requests post 24 hrs from payment confirmation.',
    ]);

    document
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#55565b')
      .text(
        'Note : MEE AUTO PARTS is not responsible for improper installation or usage, labor charges, loss of income, wages, salary, or car rental charges.',
        x,
        y + 24,
        { width: 510 },
      );

    this.drawSignature(document, invoice);
    this.drawFooter(document);
  }

  private startInvoicePage(
    document: PDFKit.PDFDocument,
    title: string,
    invoice: SignedMailInvoice,
    showMeta: boolean,
  ) {
    document.addPage({ margin: 0, size: 'A4' });
    document.rect(0, 0, 595.28, 841.89).fill('#e5e1e1');
    document.rect(0, 0, 595.28, 5).fill('#9d9d9d');

    const logoPath = this.findInvoiceLogoPath();
    if (existsSync(logoPath)) {
      document.image(logoPath, 70, 28, { width: 260 });
    }

    document
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#67686e')
      .text(
        'MEEHIKAA AUTO PARTS INC. - 440 E HUNTINGTON DR STE 300 ARCADIA, CA 91006-3775',
        68,
        112,
        { width: 275, align: 'center' },
      )
      .moveTo(30, 132)
      .lineTo(565, 132)
      .lineWidth(2)
      .strokeColor('#9c9c9c')
      .stroke();

    document
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#f4f4f4')
      .text(title, 382, 36, { width: 172 });

    if (showMeta) {
      this.drawMetaLine(document, 'Invoice Number', invoice.invoiceNumber, 382, 78);
      this.drawMetaLine(document, 'Invoice Date', this.formatDate(new Date()), 382, 102);
      this.drawMetaLine(document, 'Sale Assistant', invoice.salesAssistant ?? '', 382, 126);
    }
  }

  private drawMetaLine(
    document: PDFKit.PDFDocument,
    label: string,
    value: string,
    x: number,
    y: number,
  ) {
    document
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#5b5c62')
      .text(label, x, y)
      .font('Helvetica')
      .fillColor('#111827')
      .text(value, x + 110, y);
  }

  private drawLabelValue(
    document: PDFKit.PDFDocument,
    label: string,
    value: string | null | undefined,
    x: number,
    y: number,
  ) {
    document
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#5b5c62')
      .text(label, x, y, { continued: true })
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#111827')
      .text(` ${value ?? ''}`, { width: 188 });
  }

  private drawRoundedBox(
    document: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    document
      .roundedRect(x, y, width, height, 8)
      .lineWidth(1)
      .strokeColor('#111111')
      .stroke();
  }

  private drawChargeLine(
    document: PDFKit.PDFDocument,
    label: string,
    value: number,
    x: number,
    y: number,
  ) {
    document
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#66676d')
      .text(label, x, y)
      .fillColor('#111827')
      .text(this.formatMoney(value), x + 132, y);
  }

  private drawSignature(document: PDFKit.PDFDocument, invoice: SignedMailInvoice) {
    const x = 395;
    const y = 756;
    document
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#17172f')
      .text('Customer Signature :', x - 140, y + 15, { width: 135, align: 'right' })
      .moveTo(x, y)
      .lineTo(x + 180, y)
      .moveTo(x, y)
      .lineTo(x, y + 82)
      .moveTo(x + 180, y)
      .lineTo(x + 180, y + 82)
      .moveTo(x, y + 82)
      .lineTo(x + 180, y + 82)
      .lineWidth(2)
      .strokeColor('#111111')
      .stroke();

    const signatureImage = this.parseDataUrlImage(invoice.customerSignatureImage);
    if (signatureImage) {
      document.image(signatureImage.buffer, x + 18, y + 10, {
        fit: [142, 38],
      });
    } else if (invoice.customerSignature) {
      document
        .font('Helvetica-Oblique')
        .fontSize(18)
        .fillColor('#111111')
        .text(invoice.customerSignature, x + 10, y + 18, {
          width: 160,
          align: 'center',
        });
    }

    document
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#111111')
      .text(invoice.signatureDate ? this.formatShortDate(invoice.signatureDate) : '', x, y + 56, {
        width: 180,
        align: 'center',
      });
  }

  private drawFooter(document: PDFKit.PDFDocument) {
    document
      .font('Helvetica')
      .fontSize(14)
      .fillColor('#62666f')
      .text('www.meeautoparts.com   |   (888) 338-9652   |   support@meeautoparts.com', 18, 808);
  }

  private drawWarrantySection(
    document: PDFKit.PDFDocument,
    x: number,
    y: number,
    title: string,
    items: string[],
  ) {
    document
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#55565b')
      .text(title, x, y);

    let nextY = y + 16;
    document.font('Helvetica').fontSize(9).fillColor('#55565b');
    for (const item of items) {
      document.text(`• ${item}`, x + 10, nextY, { width: 500 });
      nextY = document.y + 3;
    }

    return nextY;
  }

  private parseDataUrlImage(value?: string | null): { buffer: Buffer } | null {
    if (!value) {
      return null;
    }

    const match = value.match(/^data:image\/(?:png|jpe?g);base64,(.+)$/i);
    if (!match?.[1]) {
      return null;
    }

    return { buffer: Buffer.from(match[1], 'base64') };
  }

  private parsePdfDataUrl(value?: string | null): Buffer | null {
    if (!value) {
      return null;
    }

    const match = value.match(/^data:application\/pdf;base64,(.+)$/i);
    if (!match?.[1]) {
      return null;
    }

    return Buffer.from(match[1], 'base64');
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat('en-US', {
      currency: 'USD',
      style: 'currency',
    }).format(value);
  }

  private formatDate(value: Date): string {
    return value
      .toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
      .replace(',', '');
  }

  private formatShortDate(value: Date): string {
    return value.toLocaleDateString('en-US');
  }

  private findInvoiceLogoPath(): string {
    const cwd = process.cwd();
    const candidatePaths = [
      join(cwd, 'frontend', 'public', 'images', 'invoice-logo.png'),
      join(cwd, '..', 'frontend', 'public', 'images', 'invoice-logo.png'),
    ];

    return candidatePaths.find((candidatePath) => existsSync(candidatePath)) ?? candidatePaths[0];
  }
}
