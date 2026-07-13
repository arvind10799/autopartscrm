import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

type MailInvoice = {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  signedAt?: Date | null;
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

  async sendSignedConfirmation(invoice: MailInvoice, signedInvoiceHtml: string) {
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
          filename: `invoice-${invoice.invoiceNumber}-signed.html`,
          content: signedInvoiceHtml,
          contentType: 'text/html',
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
      content: string;
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
}
