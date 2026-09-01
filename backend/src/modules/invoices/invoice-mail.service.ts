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
  totalAmount?: number;
  currency?: string | null;
  signatureTokenExpiresAt?: Date | null;
  signedAt?: Date | null;
};

type SignedMailInvoice = MailInvoice & {
  invoiceDate: Date;
  salesAssistant?: string | null;
  contactNumber?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  shippingVendor: string;
  deliveryTimeline: string;
  itemDescription: string;
  vehiclePartDescription?: string | null;
  warrantyPartsOnly?: string | null;
  cancellationPolicy?: string | null;
  quantity: number;
  saleAmount: number;
  currency?: string | null;
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

const DEFAULT_WARRANTY_PARTS_ONLY = [
  'Standard: 90 days for non-performance engines and transmissions.',
  "No Warranty: Rotary engines, engine accessories (alternator, turbocharger, sensors), and labor - any accesories sent isn't charged or covered.",
  'Voided Warranty: Overheating, abuse, improper installation, or failure to install a new timing belt/tensioner and/or accesories.',
  'Coverage: Engines are guaranteed against rod knock, cracked blocks, and internal issues.',
  'Warranty is void if the part requires modifications to fit or if it necessitates alterations or replacement of other components.',
].join('\n');
const DEFAULT_CANCELLATION_POLICY =
  'Cancellation request after payment confirmation will have standard 25% restocking fee remainder will be refunded to the source payment method except wire payments, also additional shipping charges will apply for any requests post 24 hrs from payment confirmation.';

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
    const formattedAmount =
      typeof invoice.totalAmount === 'number'
        ? this.formatMoney(invoice.totalAmount, invoice.currency)
        : 'Available on invoice';

    await this.sendMail({
      to: invoice.customerEmail,
      subject: `Invoice ${invoice.invoiceNumber} from MEE AUTO PARTS`,
      html: this.buildSignatureRequestHtml(invoice, signingUrl),
      text: [
        `Hi ${invoice.customerName},`,
        '',
        'Thank you for your order with MEE AUTO PARTS.',
        '',
        `Your invoice ${invoice.invoiceNumber} is ready for review. Please open the invoice using the link below and complete the required signature.`,
        '',
        'Review invoice:',
        signingUrl,
        '',
        `Order: ${invoice.invoiceNumber}`,
        `Invoice Number: ${invoice.invoiceNumber}`,
        `Amount: ${formattedAmount}`,
        `Expiry Date: ${this.formatSignatureRequestExpiry(invoice.signatureTokenExpiresAt)}`,
        '',
        'Thank you,',
        'MEE AUTO PARTS',
        'support@meeautoparts.com',
        '(888) 338-9652',
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
        <p>MEE AUTO PARTS</p>
      `,
      text: [
        'Thank you.',
        '',
        'Your signed invoice has been received.',
        '',
        'A copy of the signed invoice is attached.',
        '',
        'MEE AUTO PARTS',
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
        'MEE AUTO PARTS Billing <billing@meeautoparts.com>',
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

  private buildSignatureRequestHtml(
    invoice: MailInvoice,
    signingUrl: string,
  ): string {
    const safeCustomerName = this.escapeHtml(invoice.customerName);
    const safeCustomerEmail = this.escapeHtml(invoice.customerEmail);
    const safeSigningUrl = this.escapeHtml(signingUrl);
    const safeInvoiceNumber = this.escapeHtml(invoice.invoiceNumber);
    const safeAmount = this.escapeHtml(
      typeof invoice.totalAmount === 'number'
        ? this.formatMoney(invoice.totalAmount, invoice.currency)
        : 'Available on invoice',
    );
    const safeExpiry = this.escapeHtml(
      this.formatSignatureRequestExpiry(invoice.signatureTokenExpiresAt),
    );
    const safeLogoUrl = this.escapeHtml(this.buildPublicAssetUrl('/images/logo.png'));

    return `
      <!doctype html>
      <html>
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Invoice from MEE AUTO PARTS</title>
        </head>
        <body style="margin:0;padding:0;background:#fdeaea;font-family:Arial,Helvetica,sans-serif;color:#101828;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fdeaea;margin:0;padding:46px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:575px;margin:0 auto;">
                  <tr>
                    <td align="center" style="padding:0 0 20px;">
                      <img src="${safeLogoUrl}" width="140" alt="MEE AUTO PARTS" style="display:block;border:0;outline:none;text-decoration:none;width:140px;height:auto;" />
                    </td>
                  </tr>
                  <tr>
                    <td style="background:#ffffff;padding:36px 48px 0;">
                      <p style="margin:0 0 22px;font-size:16px;line-height:1.5;color:#101828;">Hi ${safeCustomerName},</p>
                      <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#101828;">
                        Thank you for your order with <strong>MEE AUTO PARTS</strong>.
                      </p>
                      <p style="margin:0 0 26px;font-size:16px;line-height:1.5;color:#101828;">
                        Your invoice <strong>${safeInvoiceNumber}</strong> is ready for review. Please open the invoice using the button below and complete the required signature.
                      </p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" style="padding:0 0 34px;">
                            <a href="${safeSigningUrl}" style="display:inline-block;background:#3f0df6;color:#ffffff;font-size:16px;font-weight:700;line-height:1;text-decoration:none;border-radius:4px;padding:16px 26px;">
                              Review Invoice
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 26px;text-align:center;font-size:14px;line-height:1.5;color:#667085;">Order and invoice details</p>
                      <p style="margin:0 0 8px;font-size:16px;line-height:1.5;color:#101828;"><strong>Order:</strong></p>
                      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#344054;">${safeInvoiceNumber}</p>
                      <p style="margin:0 0 8px;font-size:16px;line-height:1.5;color:#101828;"><strong>Invoice Number:</strong></p>
                      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#344054;">${safeInvoiceNumber}</p>
                      <p style="margin:0 0 8px;font-size:16px;line-height:1.5;color:#101828;"><strong>Amount:</strong></p>
                      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#344054;">${safeAmount}</p>
                      <p style="margin:0 0 8px;font-size:16px;line-height:1.5;color:#101828;"><strong>Expiry Date:</strong></p>
                      <p style="margin:0 0 28px;font-size:15px;line-height:1.5;color:#344054;">${safeExpiry}</p>
                      <div style="height:1px;background:#e4e7ec;margin:0 0 28px;"></div>
                      <p style="margin:0 0 22px;font-size:16px;line-height:1.5;color:#101828;"><strong>Customer:</strong></p>
                      <p style="margin:0 0 34px;font-size:15px;line-height:1.5;color:#344054;">
                        ${safeCustomerName}
                        (<a href="mailto:${safeCustomerEmail}" style="color:#0645ff;text-decoration:underline;">${safeCustomerEmail}</a>)
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="background:#f8fafc;padding:18px 28px;color:#667085;font-size:12px;line-height:1.5;">
                      MEE AUTO PARTS &nbsp;|&nbsp; support@meeautoparts.com &nbsp;|&nbsp; (888) 338-9652
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  private buildPublicAssetUrl(path: string): string {
    const baseUrl = this.configService
      .get<string>('APP_BASE_URL', 'https://crm.meeautoparts.com')
      .replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${baseUrl}${normalizedPath}`;
  }

  private formatSignatureRequestExpiry(value?: Date | null): string {
    if (!value) {
      return '30 days from request';
    }

    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'shortOffset',
    }).format(value);
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
    const shippingAddress = this.splitShippingAddress(invoice.shippingAddress);

    document
      .fontSize(11)
      .fillColor('#56575c')
      .font('Helvetica-Bold')
      .text('Shipping Address:', left + 10, 138)
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#111827')
      .text(shippingAddress.businessName, left + 116, 139, { width: 168 })
      .font('Helvetica')
      .text(shippingAddress.businessAddress, left + 116, shippingAddress.businessName ? 151 : 139, {
        width: 168,
        lineGap: 2,
      });

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
        286,
      )
      .moveTo(left, 306)
      .lineTo(right, 306)
      .lineWidth(2)
      .strokeColor('#9c9c9c')
      .stroke();

    this.drawRoundedBox(document, left, 318, 535, 96);
    document
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#5b5c62')
      .text('Item Descriptions', left + 12, 328)
      .text('Qty', 405, 328, { width: 42, align: 'center' })
      .text('Amount', 486, 328, { width: 56, align: 'center' });

    document
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#111827')
      .text(this.normalizeMultilineText(invoice.itemDescription), left + 12, 356, {
        width: 300,
        lineGap: 2,
      })
      .text(invoice.vehiclePartDescription ?? '', left + 12, 380, { width: 300 })
      .text(String(invoice.quantity), 405, 356, { width: 42, align: 'center' })
      .text(this.formatMoney(invoice.saleAmount, invoice.currency), 486, 356, {
        width: 56,
        align: 'center',
      });

    this.drawRoundedBox(document, left, 424, 535, 106);
    document
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#56575c')
      .text('Payment Status:', left + 12, 436)
      .text('Date:', left + 12, 450)
      .text('Payment Source:', left + 12, 464)
      .font('Helvetica')
      .fillColor('#111827')
      .text(invoice.paymentStatus ?? '', left + 92, 436)
      .text(invoice.paymentDate ? this.formatDate(invoice.paymentDate) : '', left + 92, 450)
      .text(invoice.paymentSource ?? '', left + 92, 464);

    document
      .fontSize(8.5)
      .fillColor('#ff1f28')
      .text('Additional charges will be applicable :', left + 12, 488, {
        underline: true,
      })
      .fontSize(6.5)
      .fillColor('#56575c')
      .text('• If ', left + 18, 510, { continued: true })
      .fillColor('#ff1f28')
      .text('unloading equipment', { continued: true })
      .fillColor('#56575c')
      .text(' is unavailable at the time of delivery ( Freight’s only)')
      .text('• ', left + 18, 524, { continued: true })
      .fillColor('#ff1f28')
      .text('Reschedule delivery', { continued: true })
      .fillColor('#56575c')
      .text(' ( Missed or reattempt delivery )');

    this.drawChargeLine(
      document,
      'Shipping Cost',
      invoice.shippingCost,
      invoice.currency,
      388,
      436,
    );
    this.drawChargeLine(
      document,
      'Sales Taxes',
      invoice.salesTaxes,
      invoice.currency,
      388,
      452,
    );
    this.drawChargeLine(
      document,
      'Core Charge',
      invoice.coreCharge,
      invoice.currency,
      388,
      468,
    );
    document
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#4f5056')
      .text('TOTAL', 390, 504)
      .fontSize(8)
      .fillColor('#111827')
      .text(this.formatMoney(invoice.totalAmount, invoice.currency), 500, 506);

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
    y = this.drawWarrantySection(
      document,
      x,
      y,
      'Warranty ( parts only )',
      this.parseWarrantyLines(invoice.warrantyPartsOnly),
    );
    y = this.drawWarrantySection(document, x, y + 12, 'Installation & Returns', [
      'Installation: Engines and transmissions must be installed within 15 days from the day of delivery by a licensed professional at a licensed repair facility, following manufacturer guidelines.',
      'All parts must be installed within 15 days of delivery. Failure to complete the installation within this timeframe will void any warranty claims.',
      'Defective Parts: MEE AUTO PARTS will exchange defective parts or issue a refund only if the part is out of stock.',
      'Returns: Parts must be returned in their original condition.',
    ]);
    y = this.drawWarrantySection(
      document,
      x,
      y + 12,
      'Cancellation',
      this.parseCancellationLines(invoice.cancellationPolicy),
    );

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

    const watermarkPath = this.findInvoiceWatermarkPath();
    if (existsSync(watermarkPath)) {
      document
        .save()
        .opacity(0.045)
        .image(watermarkPath, 0, 0, { width: 595.28, height: 841.89 })
        .restore();
    }

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
      this.drawMetaLine(
        document,
        'Invoice Date',
        this.formatDate(invoice.invoiceDate),
        382,
        102,
      );
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
    currency: string | null | undefined,
    x: number,
    y: number,
  ) {
    document
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#66676d')
      .text(label, x, y)
      .fillColor('#111827')
      .text(this.formatMoney(value, currency), x + 132, y);
  }

  private drawSignature(document: PDFKit.PDFDocument, invoice: SignedMailInvoice) {
    const x = 450;
    const y = 769;

    const signatureImage = this.parseDataUrlImage(invoice.customerSignatureImage);
    if (signatureImage) {
      document.image(signatureImage.buffer, x + 8, y + 4, {
        fit: [126, 30],
      });
    } else if (invoice.customerSignature) {
      document
        .font('Helvetica-Oblique')
        .fontSize(18)
        .fillColor('#111111')
        .text(invoice.customerSignature, x + 6, y + 8, {
          width: 126,
          align: 'center',
        });
    }

    document
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor('#111111')
      .text('Date:', x, y + 41)
      .font('Helvetica')
      .text(invoice.signatureDate ? this.formatShortDate(invoice.signatureDate) : '', x + 28, y + 41, {
        width: 100,
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
      .fontSize(7.8)
      .fillColor('#55565b')
      .text(title, x, y);

    let templateNextY = y + 12;
    document.font('Helvetica').fontSize(7.2).fillColor('#55565b');
    for (const item of items) {
      document.text(`- ${item}`, x + 8, templateNextY, { width: 500 });
      templateNextY = document.y + 1.5;
    }

    return templateNextY;

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

  private parseWarrantyLines(value?: string | null): string[] {
    const source = value?.trim() ? value : DEFAULT_WARRANTY_PARTS_ONLY;

    return source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private parseCancellationLines(value?: string | null): string[] {
    const source = value?.trim() ? value : DEFAULT_CANCELLATION_POLICY;

    return source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
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

  private formatMoney(value: number, currency?: string | null): string {
    return new Intl.NumberFormat('en-US', {
      currency: currency === 'CAD' ? 'CAD' : 'USD',
      style: 'currency',
    }).format(value);
  }

  private formatDate(value: Date | null | undefined): string {
    if (!value) {
      return '';
    }

    const dateOnlyValue = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );

    return dateOnlyValue
      .toLocaleDateString('en-US', {
        timeZone: 'UTC',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
      .replace(',', '');
  }

  private formatShortDate(value: Date): string {
    return value.toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles',
    });
  }

  private normalizeMultilineText(value: string): string {
    return value.replace(/\r\n?/g, '\n');
  }

  private splitShippingAddress(value?: string | null): {
    businessName: string;
    businessAddress: string;
  } {
    const lines = this.normalizeMultilineText(value ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      return {
        businessName: '',
        businessAddress: lines.join('\n'),
      };
    }

    return {
      businessName: lines[0],
      businessAddress: lines.slice(1).join('\n'),
    };
  }

  private findInvoiceLogoPath(): string {
    const cwd = process.cwd();
    const candidatePaths = [
      join(cwd, 'frontend', 'public', 'images', 'invoice-logo.png'),
      join(cwd, '..', 'frontend', 'public', 'images', 'invoice-logo.png'),
    ];

    return candidatePaths.find((candidatePath) => existsSync(candidatePath)) ?? candidatePaths[0];
  }

  private findInvoiceWatermarkPath(): string {
    const cwd = process.cwd();
    const candidatePaths = [
      join(
        cwd,
        'frontend',
        'public',
        'images',
        'invoice-template',
        'mee-auto-parts-watermark.png',
      ),
      join(
        cwd,
        '..',
        'frontend',
        'public',
        'images',
        'invoice-template',
        'mee-auto-parts-watermark.png',
      ),
    ];

    return candidatePaths.find((candidatePath) => existsSync(candidatePath)) ?? candidatePaths[0];
  }

}
