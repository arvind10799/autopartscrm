'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { CheckCircle2, Download, Eye, FileText, Link2, LoaderCircle, Send, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { invoicesApi } from '@/features/invoices/api/invoices-api';
import type { CreateInvoiceInput, InvoiceDefaults, InvoiceRecord } from '@/features/invoices/types/invoice.types';
import type { OrderDetail } from '@/features/orders/types/order.types';
import { toast } from '@/lib/stores/toast.store';
import { cn } from '@/lib/utils/cn';

type InvoiceDraft = {
  invoiceNumber: string;
  invoiceDate: string;
  salesAssistant: string;
  customerName: string;
  contactNumber: string;
  billingAddress: string;
  shippingAddress: string;
  shippingVendor: string;
  deliveryTimeline: string;
  itemDescription: string;
  vehiclePartDescription: string;
  quantity: string;
  saleAmount: string;
  paymentStatus: string;
  paymentDate: string;
  paymentSource: string;
  shippingCost: string;
  salesTaxes: string;
  coreCharge: string;
  customerSignature: string;
  customerSignatureImage: string;
  signatureDate: string;
};

export function InvoiceActions({
  order,
  onInvoiceCreated,
}: {
  order: OrderDetail;
  onInvoiceCreated: () => void;
}) {
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(order.invoice);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSignatureActionRunning, setIsSignatureActionRunning] = useState(false);
  const authUser = useAuthStore((state) => state.user);
  const printableInvoiceRef = useRef<HTMLDivElement>(null);
  const canManageSignatureRequest =
    authUser?.role === 'ADMIN' || authUser?.role === 'SALES';

  useEffect(() => {
    setInvoice(order.invoice);
  }, [order.invoice]);

  const printableInvoice = invoice ?? (draft ? draftToInvoicePreview(order.id, draft) : null);

  const totalAmount = useMemo(() => {
    if (!draft) {
      return 0;
    }

    return calculateInvoiceTotal(draft);
  }, [draft]);

  const openGenerateModal = async () => {
    setIsLoadingDefaults(true);
    setFormError(null);

    try {
      const defaults = await invoicesApi.getDefaults(order.id);
      setDraft(defaultsToDraft(defaults));
      setIsGenerateOpen(true);
    } catch (caughtError) {
      toast.error(
        'Invoice defaults unavailable',
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to prepare the invoice form.',
      );
    } finally {
      setIsLoadingDefaults(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!draft) {
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const createdInvoice = await invoicesApi.create(order.id, draftToPayload(draft));
      setInvoice(createdInvoice);
      setIsGenerateOpen(false);
      setIsViewOpen(true);
      onInvoiceCreated();
      toast.success(
        'Invoice generated',
        createdInvoice.status === 'SIGNATURE_REQUESTED'
          ? 'The customer signature request has been emailed.'
          : 'The invoice is now linked to this order.',
      );
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to generate this invoice.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignatureAction = async (
    action: 'resend' | 'new-link',
  ) => {
    setIsSignatureActionRunning(true);

    try {
      const updatedInvoice =
        action === 'resend'
          ? await invoicesApi.resendSignatureRequest(order.id)
          : await invoicesApi.generateNewSigningLink(order.id);
      setInvoice(updatedInvoice);
      onInvoiceCreated();
      toast.success(
        action === 'resend'
          ? 'Signature request sent'
          : 'New signing link sent',
        'The customer has been emailed a secure signing link.',
      );
    } catch (caughtError) {
      toast.error(
        'Unable to send signing link',
        caughtError instanceof Error
          ? caughtError.message
          : 'Please try again in a moment.',
      );
    } finally {
      setIsSignatureActionRunning(false);
    }
  };

  const handleDownloadInvoice = () => {
    if (!printableInvoiceRef.current) {
      toast.error('Invoice not ready', 'Open or generate the invoice and try again.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=980,height=1100');

    if (!printWindow) {
      toast.error('Popup blocked', 'Allow popups to download the invoice PDF.');
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(printableInvoice?.invoiceNumber ?? order.orderNumber)} Invoice</title>
          <base href="${window.location.origin}" />
        </head>
        <body>${printableInvoiceRef.current.outerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 350);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            Invoice Management
          </CardTitle>
          <CardDescription>
            Generate, view, and download the purchase invoice for this order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoice ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {invoice.status === 'SIGNED' ? 'Signed' : 'Invoiced'}
              </Badge>
              <Button type="button" size="sm" variant="outline" onClick={() => setIsViewOpen(true)}>
                <Eye className="h-4 w-4" />
                {invoice.status === 'SIGNED' ? 'View Signed Invoice' : 'View Invoice'}
              </Button>
              <Button type="button" size="sm" onClick={handleDownloadInvoice}>
                <Download className="h-4 w-4" />
                {invoice.status === 'SIGNED' ? 'Download Signed Invoice' : 'Download Invoice (PDF)'}
              </Button>
              {invoice.status !== 'SIGNED' && canManageSignatureRequest ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isSignatureActionRunning}
                    onClick={() => void handleSignatureAction('resend')}
                  >
                    {isSignatureActionRunning ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Resend Signature Request
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isSignatureActionRunning}
                    onClick={() => void handleSignatureAction('new-link')}
                  >
                    <Link2 className="h-4 w-4" />
                    Generate New Signing Link
                  </Button>
                </>
              ) : null}
            </div>
          ) : (
            <Button type="button" size="sm" onClick={openGenerateModal} disabled={isLoadingDefaults}>
              {isLoadingDefaults ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Generate Invoice
            </Button>
          )}
        </CardContent>
      </Card>

      {isGenerateOpen && draft ? (
        <InvoiceFormModal
          draft={draft}
          error={formError}
          isSaving={isSaving}
          totalAmount={totalAmount}
          onChange={setDraft}
          onClose={() => setIsGenerateOpen(false)}
          onSubmit={handleCreateInvoice}
        />
      ) : null}

      {isViewOpen && invoice ? (
        <InvoiceViewModal
          invoice={invoice}
          onClose={() => setIsViewOpen(false)}
          onDownload={handleDownloadInvoice}
        />
      ) : null}

      {printableInvoice ? (
        <div className="pointer-events-none fixed -left-[9999px] top-0">
          <InvoiceDocument ref={printableInvoiceRef} invoice={printableInvoice} />
        </div>
      ) : null}
    </>
  );
}

function InvoiceFormModal({
  draft,
  error,
  isSaving,
  totalAmount,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: InvoiceDraft;
  error: string | null;
  isSaving: boolean;
  totalAmount: number;
  onChange: (nextDraft: InvoiceDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const updateField = (field: keyof InvoiceDraft, value: string) => {
    onChange({
      ...draft,
      [field]: value,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl rounded-[2rem] border border-white/70 bg-white p-5 shadow-2xl shadow-slate-950/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-semibold text-foreground">
              Generate Invoice
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Prefilled from the order. All values can be edited before saving.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <InvoiceFormSection title="Invoice Information">
              <InvoiceInput label="Invoice Number" value={draft.invoiceNumber} onChange={(value) => updateField('invoiceNumber', value)} />
              <InvoiceInput label="Invoice Date" type="date" value={draft.invoiceDate} onChange={(value) => updateField('invoiceDate', value)} />
              <InvoiceInput label="Sales Assistant" value={draft.salesAssistant} onChange={(value) => updateField('salesAssistant', value)} />
            </InvoiceFormSection>

            <InvoiceFormSection title="Customer Information">
              <InvoiceInput label="Customer Name" value={draft.customerName} onChange={(value) => updateField('customerName', value)} />
              <InvoiceInput label="Contact Number" value={draft.contactNumber} onChange={(value) => updateField('contactNumber', value)} />
              <InvoiceTextarea label="Billing Address" value={draft.billingAddress} onChange={(value) => updateField('billingAddress', value)} />
            </InvoiceFormSection>

            <InvoiceFormSection title="Shipping Information">
              <InvoiceTextarea label="Shipping Address" value={draft.shippingAddress} onChange={(value) => updateField('shippingAddress', value)} />
              <InvoiceInput label="Shipping Vendor" value={draft.shippingVendor} onChange={(value) => updateField('shippingVendor', value)} />
              <InvoiceInput label="Delivery Timeline" value={draft.deliveryTimeline} onChange={(value) => updateField('deliveryTimeline', value)} />
            </InvoiceFormSection>

            <InvoiceFormSection title="Product Information">
              <InvoiceInput label="Item Description" value={draft.itemDescription} onChange={(value) => updateField('itemDescription', value)} />
              <InvoiceInput label="Vehicle / Part Description" value={draft.vehiclePartDescription} onChange={(value) => updateField('vehiclePartDescription', value)} />
              <InvoiceInput label="Quantity" type="number" min="1" value={draft.quantity} onChange={(value) => updateField('quantity', value)} />
              <InvoiceInput label="Sale Amount" type="number" step="0.01" value={draft.saleAmount} onChange={(value) => updateField('saleAmount', value)} />
            </InvoiceFormSection>

            <InvoiceFormSection title="Payment Information">
              <InvoiceInput label="Payment Status" value={draft.paymentStatus} onChange={(value) => updateField('paymentStatus', value)} />
              <InvoiceInput label="Payment Date" type="date" value={draft.paymentDate} onChange={(value) => updateField('paymentDate', value)} />
              <InvoiceInput label="Payment Source" value={draft.paymentSource} onChange={(value) => updateField('paymentSource', value)} placeholder="Card ending ****6547" />
            </InvoiceFormSection>

            <InvoiceFormSection title="Charges & Pricing">
              <InvoiceInput label="Shipping Cost" type="number" step="0.01" value={draft.shippingCost} onChange={(value) => updateField('shippingCost', value)} />
              <InvoiceInput label="Sales Taxes" type="number" step="0.01" value={draft.salesTaxes} onChange={(value) => updateField('salesTaxes', value)} />
              <InvoiceInput label="Core Charge" type="number" step="0.01" value={draft.coreCharge} onChange={(value) => updateField('coreCharge', value)} />
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Total Amount
                </p>
                <p className="mt-1 font-[var(--font-heading)] text-2xl font-semibold tabular-nums">
                  {formatMoney(totalAmount)}
                </p>
              </div>
            </InvoiceFormSection>

            <InvoiceFormSection title="Signature Section">
              <InvoiceInput label="Customer Signature" value={draft.customerSignature} onChange={(value) => updateField('customerSignature', value)} />
              <InvoiceInput label="Signature Date" type="date" value={draft.signatureDate} onChange={(value) => updateField('signatureDate', value)} />
            </InvoiceFormSection>

            {error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Invoice'
                )}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>

          <div className="rounded-3xl border border-border/70 bg-secondary/20 p-3">
            <p className="mb-3 text-sm font-semibold text-muted-foreground">Live Preview</p>
            <div className="max-h-[78vh] overflow-auto rounded-2xl bg-white p-2">
              <div className="origin-top-left scale-[0.48]">
                <InvoiceDocument invoice={draftToInvoicePreview('preview', draft)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceViewModal({
  invoice,
  onClose,
  onDownload,
}: {
  invoice: InvoiceRecord;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-[2rem] border border-white/70 bg-white p-5 shadow-2xl shadow-slate-950/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-semibold text-foreground">
              Invoice Preview
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {invoice.invoiceNumber} • generated {formatDisplayDate(invoice.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onDownload}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
        <div className="max-h-[78vh] overflow-auto rounded-2xl bg-slate-100 p-4">
          <InvoiceDocument invoice={invoice} />
        </div>
      </div>
    </div>
  );
}

export const InvoiceDocument = forwardRef<HTMLDivElement, { invoice: InvoiceRecord }>(
function InvoiceDocument({ invoice }, ref) {
  return (
  <div ref={ref} className="invoice-document">
    <style>{INVOICE_DOCUMENT_CSS}</style>
    <div className="invoice-page">
      <img className="invoice-watermark invoice-watermark-center" src="/images/logo.png" alt="" />
      <img className="invoice-watermark invoice-watermark-bottom" src="/images/logo.png" alt="" />

      <header className="invoice-header">
        <div>
          <img className="invoice-logo" src="/images/logo.png" alt="MEE Auto Parts" />
        </div>
        <div className="invoice-title-block">
          <h1>PURCHASE INVOICE</h1>
          <div className="invoice-meta-grid">
            <span>Invoice Number</span>
            <strong>{invoice.invoiceNumber}</strong>
            <span>Invoice Date</span>
            <strong>{formatInvoiceDate(invoice.invoiceDate)}</strong>
            <span>Sale Assistant</span>
            <strong>{invoice.salesAssistant || ''}</strong>
          </div>
        </div>
      </header>

      <p className="invoice-company">
        MEEHIKAA AUTO PARTS INC. - 440 E HUNTINGTON DR STE 300 ARCADIA, CA 91006-3775
      </p>

      <section className="invoice-address-section">
        <div className="invoice-address-left">
          <InfoLine label="Shipping Address" value={invoice.shippingAddress} />
          <InfoLine label="Shipping Vendor" value={invoice.shippingVendor} />
        </div>
        <div className="invoice-address-right">
          <InfoLine label="Customer Name" value={invoice.customerName} />
          <InfoLine label="Billing Address" value={invoice.billingAddress} />
          <InfoLine label="Contact Number" value={invoice.contactNumber} />
        </div>
      </section>

      <p className="invoice-delivery">
        Delivery timeline is {invoice.deliveryTimeline}, may vary due to distance and shipping vendor
      </p>

      <section className="invoice-items">
        <div className="invoice-item-description">
          <h2>Item Descriptions</h2>
          <p className="invoice-item-main">{invoice.itemDescription}</p>
          <p>{invoice.vehiclePartDescription || ''}</p>
        </div>
        <div className="invoice-item-qty">
          <h2>Qty</h2>
          <p>{invoice.quantity}</p>
        </div>
        <div className="invoice-item-amount">
          <h2>Amount</h2>
          <p>{formatMoney(invoice.saleAmount)}</p>
        </div>
      </section>

      <section className="invoice-payment-card">
        <div className="invoice-payment-details">
          <InfoLine label="Payment Status" value={invoice.paymentStatus} />
          <InfoLine label="Date" value={invoice.paymentDate ? formatInvoiceDate(invoice.paymentDate) : ''} />
          <InfoLine label="Payment Source" value={invoice.paymentSource} />
          <div className="invoice-notice">
            <p>Additional charges will be applicable :</p>
            <ul>
              <li><span>If unloading equipment</span> is unavailable at the time of delivery ( Freight&apos;s only)</li>
              <li><span>Reschedule delivery</span> ( Missed or reattempt delivery )</li>
            </ul>
          </div>
        </div>
        <div className="invoice-charges">
          <ChargeLine label="Shipping Cost" value={invoice.shippingCost} />
          <ChargeLine label="Sales Taxes" value={invoice.salesTaxes} />
          <ChargeLine label="Core Charge" value={invoice.coreCharge} />
          <div className="invoice-total-row">
            <span>TOTAL</span>
            <strong>{formatMoney(invoice.totalAmount)}</strong>
          </div>
        </div>
      </section>

      <section className="invoice-signature">
        <div className="invoice-signature-box">
          <div className="invoice-signature-line">
            {invoice.customerSignatureImage ? (
              <img src={invoice.customerSignatureImage} alt="Customer signature" />
            ) : (
              invoice.customerSignature || ''
            )}
          </div>
          <div className="invoice-signature-date">
            <strong>Date :</strong>
            <span>{invoice.signatureDate ? formatSignatureDate(invoice.signatureDate) : ''}</span>
          </div>
        </div>
      </section>

      <footer className="invoice-footer">
        <span>🚗 www.meeautoparts.com</span>
        <span>|</span>
        <span>📞 (888) 338-9652</span>
        <span>|</span>
        <span>📧 support@meeautoparts.com</span>
      </footer>
    </div>
  </div>
  );
});

function InfoLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <p className="invoice-info-line">
      <strong>{label} :</strong>
      <span>{value || ''}</span>
    </p>
  );
}

function ChargeLine({ label, value }: { label: string; value: number }) {
  return (
    <p className="invoice-charge-line">
      <span>{label}</span>
      <strong>$ {value.toFixed(2)}</strong>
    </p>
  );
}

function InvoiceFormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function InvoiceInput({
  label,
  value,
  onChange,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={cn('space-y-1.5 text-sm font-medium text-foreground', className)}>
      <span>{label}</span>
      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-input bg-white px-4 py-2.5 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

function InvoiceTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-foreground md:col-span-2">
      <span>{label}</span>
      <textarea
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-input bg-white px-4 py-2.5 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

function defaultsToDraft(defaults: InvoiceDefaults): InvoiceDraft {
  return {
    ...defaults,
    quantity: String(defaults.quantity),
    saleAmount: formatNumberInput(defaults.saleAmount),
    shippingCost: formatNumberInput(defaults.shippingCost),
    salesTaxes: formatNumberInput(defaults.salesTaxes),
    coreCharge: formatNumberInput(defaults.coreCharge),
  };
}

function draftToPayload(draft: InvoiceDraft): CreateInvoiceInput {
  return {
    invoiceNumber: draft.invoiceNumber,
    invoiceDate: draft.invoiceDate,
    salesAssistant: draft.salesAssistant,
    customerName: draft.customerName,
    contactNumber: draft.contactNumber,
    billingAddress: draft.billingAddress,
    shippingAddress: draft.shippingAddress,
    shippingVendor: draft.shippingVendor,
    deliveryTimeline: draft.deliveryTimeline,
    itemDescription: draft.itemDescription,
    vehiclePartDescription: draft.vehiclePartDescription,
    quantity: Number(draft.quantity),
    saleAmount: toAmount(draft.saleAmount),
    paymentStatus: draft.paymentStatus,
    paymentDate: draft.paymentDate,
    paymentSource: draft.paymentSource,
    shippingCost: toAmount(draft.shippingCost),
    salesTaxes: toAmount(draft.salesTaxes),
    coreCharge: toAmount(draft.coreCharge),
    customerSignature: draft.customerSignature,
    signatureDate: draft.signatureDate,
  };
}

function draftToInvoicePreview(orderId: string, draft: InvoiceDraft): InvoiceRecord {
  return {
    id: 'preview',
    orderId,
    ...draftToPayload(draft),
    salesAssistant: draft.salesAssistant || null,
    contactNumber: draft.contactNumber || null,
    billingAddress: draft.billingAddress || null,
    shippingAddress: draft.shippingAddress || null,
    vehiclePartDescription: draft.vehiclePartDescription || null,
    paymentStatus: draft.paymentStatus || null,
    paymentDate: draft.paymentDate || null,
    paymentSource: draft.paymentSource || null,
    customerSignature: draft.customerSignature || null,
    customerSignatureImage: draft.customerSignatureImage || null,
    signatureDate: draft.signatureDate || null,
    signedAt: null,
    signatureIpAddress: null,
    signatureTokenExpiresAt: null,
    signatureRequestedAt: null,
    signatureLastSentAt: null,
    totalAmount: calculateInvoiceTotal(draft),
    status: 'PREVIEW',
    pdfStorageKey: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function calculateInvoiceTotal(draft: InvoiceDraft): number {
  return Math.max(
    toAmount(draft.saleAmount) -
      toAmount(draft.shippingCost) -
      toAmount(draft.salesTaxes) -
      toAmount(draft.coreCharge),
    0,
  );
}

function toAmount(value: string): number {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatNumberInput(value: number): string {
  return value.toFixed(2);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatInvoiceDate(value: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).replace(',', '');
}

function formatSignatureDate(value: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US');
}

function formatDisplayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const INVOICE_DOCUMENT_CSS = `
  .invoice-document {
    width: 794px;
    min-height: 1123px;
    color: #5d646b;
    font-family: Arial, Helvetica, sans-serif;
    background: #d9d6d6;
  }

  .invoice-page {
    position: relative;
    width: 794px;
    min-height: 1123px;
    padding: 14px 24px 18px;
    overflow: hidden;
    background: #d9d6d6;
    border-top: 10px solid #8d8b8b;
    border-bottom: 10px solid #8d8b8b;
  }

  .invoice-watermark {
    position: absolute;
    left: 50%;
    z-index: 0;
    width: 600px;
    max-width: none;
    opacity: 0.07;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .invoice-watermark-center {
    top: 168px;
  }

  .invoice-watermark-bottom {
    bottom: 145px;
    width: 660px;
    opacity: 0.12;
  }

  .invoice-header,
  .invoice-company,
  .invoice-address-section,
  .invoice-delivery,
  .invoice-items,
  .invoice-payment-card,
  .invoice-signature,
  .invoice-footer {
    position: relative;
    z-index: 1;
  }

  .invoice-header {
    display: grid;
    grid-template-columns: 1fr 316px;
    gap: 24px;
    align-items: start;
  }

  .invoice-logo {
    width: 360px;
    height: auto;
    margin: 2px 0 18px 25px;
  }

  .invoice-title-block h1 {
    margin: 0 0 10px;
    color: #87929c;
    font-size: 29px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: -1px;
    text-align: center;
  }

  .invoice-meta-grid {
    display: grid;
    grid-template-columns: 1.05fr 1.4fr;
    background: rgba(240, 240, 240, 0.65);
    font-size: 14px;
  }

  .invoice-meta-grid span,
  .invoice-meta-grid strong {
    padding: 5px 8px;
    min-height: 22px;
  }

  .invoice-meta-grid span {
    color: #777;
    font-weight: 800;
    border-right: 1px solid rgba(255, 255, 255, 0.9);
  }

  .invoice-meta-grid strong {
    color: #777;
    font-weight: 500;
  }

  .invoice-company {
    margin: 8px 22px 8px;
    padding-bottom: 8px;
    border-bottom: 4px solid #919191;
    color: #4f4f4f;
    font-size: 10px;
    letter-spacing: 0.1px;
  }

  .invoice-address-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 130px;
    padding: 6px 28px 0;
    font-size: 13px;
  }

  .invoice-address-left {
    padding-right: 22px;
  }

  .invoice-address-right {
    border-left: 2px solid #8c8c8c;
    padding-left: 8px;
  }

  .invoice-info-line {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px;
    margin: 0 0 46px;
    line-height: 1.25;
  }

  .invoice-address-right .invoice-info-line {
    margin-bottom: 38px;
  }

  .invoice-info-line strong {
    color: #7c7c7c;
    font-weight: 800;
  }

  .invoice-info-line span {
    white-space: pre-wrap;
    color: #777;
  }

  .invoice-delivery {
    margin: 0 0 8px;
    padding: 8px 0 10px;
    border-bottom: 4px solid #919191;
    color: #4f4f4f;
    font-size: 15px;
    text-align: center;
  }

  .invoice-items {
    display: grid;
    grid-template-columns: 1fr 120px 155px;
    min-height: 138px;
    margin: 8px 0 8px;
    padding: 10px 12px;
    border: 1px solid #111;
    border-radius: 10px;
  }

  .invoice-items h2 {
    margin: 0 0 6px;
    color: #62666e;
    font-size: 18px;
    line-height: 1;
    font-weight: 800;
  }

  .invoice-items p {
    margin: 0 0 18px;
    color: #777;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.35;
  }

  .invoice-item-main {
    font-weight: 800;
  }

  .invoice-item-qty,
  .invoice-item-amount {
    text-align: center;
  }

  .invoice-item-qty p,
  .invoice-item-amount p {
    font-size: 14px;
    font-weight: 500;
  }

  .invoice-payment-card {
    display: grid;
    grid-template-columns: 1.25fr 1fr;
    gap: 24px;
    min-height: 150px;
    padding: 10px 12px 12px;
    border: 1px solid #111;
    border-radius: 10px;
  }

  .invoice-payment-card .invoice-info-line {
    grid-template-columns: 115px 1fr;
    margin-bottom: 7px;
    font-size: 13px;
  }

  .invoice-notice {
    margin-top: 30px;
    font-size: 11px;
    color: #444;
  }

  .invoice-notice p {
    display: inline-block;
    margin: 0 0 4px;
    color: #ff1717;
    text-decoration: underline;
  }

  .invoice-notice ul {
    margin: 0;
    padding-left: 20px;
  }

  .invoice-notice li {
    margin: 4px 0;
  }

  .invoice-notice span {
    color: #ff1717;
  }

  .invoice-charges {
    padding: 0 58px 0 40px;
  }

  .invoice-charge-line,
  .invoice-total-row {
    display: grid;
    grid-template-columns: 1fr 92px;
    gap: 10px;
    margin: 0 0 5px;
    align-items: baseline;
  }

  .invoice-charge-line span,
  .invoice-charge-line strong {
    color: #62666e;
    font-size: 13px;
    font-weight: 500;
  }

  .invoice-total-row {
    margin-top: 20px;
  }

  .invoice-total-row span,
  .invoice-total-row strong {
    color: #50565c;
    font-size: 17px;
    font-weight: 800;
  }

  .invoice-signature {
    min-height: 380px;
  }

  .invoice-signature-box {
    position: absolute;
    right: 0;
    bottom: 54px;
    width: 196px;
    height: 88px;
    border: 2px solid #111;
    border-top: none;
  }

  .invoice-signature-line {
    min-height: 52px;
    border-top: 2px solid #111;
    color: #111;
    font-family: "Brush Script MT", cursive;
    font-size: 26px;
    line-height: 52px;
    text-align: center;
  }

  .invoice-signature-line img {
    max-width: 170px;
    max-height: 46px;
    object-fit: contain;
    vertical-align: middle;
  }

  .invoice-signature-date {
    display: flex;
    gap: 8px;
    align-items: center;
    border-top: 2px solid #111;
    padding: 7px 2px;
    color: #111;
    font-size: 12px;
  }

  .invoice-footer {
    position: absolute;
    left: 12px;
    bottom: 8px;
    display: flex;
    gap: 10px;
    align-items: center;
    color: #5f6870;
    font-size: 15px;
  }

  @media print {
    body {
      margin: 0;
      background: #d9d6d6;
    }

    .invoice-document {
      width: 794px;
      min-height: 1123px;
    }
  }
`;
