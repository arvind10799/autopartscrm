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
              <div className="mx-auto w-full max-w-[794px]">
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
              {invoice.invoiceNumber} â€¢ generated {formatDisplayDate(invoice.createdAt)}
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
          <div className="mx-auto w-full max-w-[794px]">
            <InvoiceDocument invoice={invoice} />
          </div>
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
      <InvoiceHeader title="PURCHASE INVOICE" invoice={invoice} showMeta />

      <section className="invoice-address-grid">
        <div className="invoice-address-left">
          <InvoiceLabelValue label="Shipping Address" value={invoice.shippingAddress} />
          <InvoiceLabelValue label="Shipping Vendor" value={invoice.shippingVendor || 'LTL'} inline />
        </div>
        <div className="invoice-address-divider" />
        <div className="invoice-address-right">
          <InvoiceLabelValue label="Customer Name" value={invoice.customerName} />
          <InvoiceLabelValue label="Billing Address" value={invoice.billingAddress} />
          <InvoiceLabelValue label="Contact Number" value={invoice.contactNumber} />
        </div>
      </section>

      <p className="invoice-delivery">
        Delivery timeline is {invoice.deliveryTimeline}, may vary due to distance and shipping vendor
      </p>

      <section className="invoice-items-box">
        <div className="invoice-items-header">
          <span>Item Descriptions</span>
          <span>Qty</span>
          <span>Amount</span>
        </div>
        <div className="invoice-items-row">
          <div>
            <p>{invoice.itemDescription}</p>
            <p>{invoice.vehiclePartDescription || ''}</p>
          </div>
          <p>{invoice.quantity}</p>
          <p>{formatMoney(invoice.saleAmount)}</p>
        </div>
      </section>

      <section className="invoice-payment-box">
        <div className="invoice-payment-info">
          <InvoiceLabelValue label="Payment Status" value={invoice.paymentStatus} compact />
          <InvoiceLabelValue label="Date" value={invoice.paymentDate ? formatInvoiceDate(invoice.paymentDate) : ''} compact />
          <InvoiceLabelValue label="Payment Source" value={invoice.paymentSource} compact />
          <div className="invoice-extra-notice">
            <p>Additional charges will be applicable :</p>
            <ul>
              <li>If <span>unloading equipment</span> is unavailable at the time of delivery ( Freight&apos;s only)</li>
              <li><span>Reschedule delivery</span> ( Missed or reattempt delivery )</li>
            </ul>
          </div>
        </div>
        <div className="invoice-charge-info">
          <InvoiceChargeLine label="Shipping Cost" value={invoice.shippingCost} />
          <InvoiceChargeLine label="Sales Taxes" value={invoice.salesTaxes} />
          <InvoiceChargeLine label="Core Charge" value={invoice.coreCharge} />
          <div className="invoice-total">
            <strong>TOTAL</strong>
            <strong>{formatMoney(invoice.totalAmount)}</strong>
          </div>
        </div>
      </section>

      <InvoiceSignature invoice={invoice} />
      <InvoiceFooter />
    </div>

    <div className="invoice-page">
      <InvoiceHeader title="WARRANTY - TERMS & CONDITION" invoice={invoice} />
      <WarrantyTerms />
      <InvoiceSignature invoice={invoice} />
      <InvoiceFooter />
    </div>
  </div>
  );
});

function InvoiceHeader({
  title,
  invoice,
  showMeta = false,
}: {
  title: string;
  invoice: InvoiceRecord;
  showMeta?: boolean;
}) {
  return (
    <header className="invoice-header">
      <div className="invoice-logo-block">
        <img className="invoice-logo" src="/images/logo.png" alt="MEE Auto Parts" />
        <p>MEEHIKAA AUTO PARTS INC. - 440 E HUNTINGTON DR STE 300 ARCADIA, CA 91006-3775</p>
      </div>
      <div className="invoice-title-block">
        <h1>{title}</h1>
        {showMeta ? (
          <div className="invoice-meta">
            <strong>Invoice Number</strong>
            <span>{invoice.invoiceNumber}</span>
            <strong>Invoice Date</strong>
            <span>{formatInvoiceDate(invoice.invoiceDate)}</span>
            <strong>Sale Assistant</strong>
            <span>{invoice.salesAssistant || ''}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function InvoiceLabelValue({
  label,
  value,
  inline = false,
  compact = false,
}: {
  label: string;
  value?: string | null;
  inline?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn('invoice-label-value', inline && 'invoice-label-value--inline', compact && 'invoice-label-value--compact')}>
      <strong>{label}:</strong>
      <span>{value || ''}</span>
    </div>
  );
}

function InvoiceChargeLine({ label, value }: { label: string; value: number }) {
  return (
    <p className="invoice-charge-line">
      <span>{label}</span>
      <span>$ {value.toFixed(2)}</span>
    </p>
  );
}

function InvoiceSignature({ invoice }: { invoice: InvoiceRecord }) {
  return (
    <section className="invoice-signature-area">
      <strong>Customer Signature :</strong>
      <div className="invoice-signature-box">
        <div className="invoice-signature-line">
          {invoice.customerSignatureImage ? (
            <img src={invoice.customerSignatureImage} alt="Customer signature" />
          ) : (
            invoice.customerSignature || ''
          )}
        </div>
        <div className="invoice-signature-date">
          {invoice.signatureDate ? formatSignatureDate(invoice.signatureDate) : ''}
        </div>
      </div>
    </section>
  );
}

function InvoiceFooter() {
  return (
    <footer className="invoice-footer">
      <span>www.meeautoparts.com</span>
      <span>|</span>
      <span>(888) 338-9652</span>
      <span>|</span>
      <span>support@meeautoparts.com</span>
    </footer>
  );
}

function WarrantyTerms() {
  return (
    <section className="invoice-warranty">
      <h2>Warranty | Returns | Cancellation</h2>

      <h3>Warranty ( parts only )</h3>
      <ul>
        <li>Standard: 90 days for non-performance engines and transmissions.</li>
        <li>No Warranty: Rotary engines, engine accessories (alternator, turbocharger, sensors), and labor - any accesories sent isn&apos;t charged or covered.</li>
        <li>Voided Warranty: Overheating, abuse, improper installation, or failure to install a new timing belt/tensioner and/or accesories.</li>
        <li>Coverage: Engines are guaranteed against rod knock, cracked blocks, and internal issues.</li>
        <li>Warranty is void if the part requires modifications to fit or if it necessitates alterations or replacement of other components.</li>
      </ul>

      <h3>Installation & Returns</h3>
      <ul>
        <li>Installation: Engines and transmissions must be installed within 15 days from the day of delivery by a licensed professional at a licensed repair facility, following manufacturer guidelines.</li>
        <li>All parts must be installed within 15 days of delivery. Failure to complete the installation within this timeframe will void any warranty claims.</li>
        <li>Defective Parts: MEE Auto Parts will exchange defective parts or issue a refund only if the part is out of stock.</li>
        <li>Returns: Parts must be returned in their original condition.</li>
      </ul>

      <h3>Cancellation</h3>
      <ul>
        <li>Cancellation request after payment confirmation will have standard 25% restocking fee remainder will be refunded to the source payment method except wire payments, also additional shipping charges will apply for any requests post 24 hrs from payment confirmation.</li>
      </ul>

      <p>
        <strong>Note :</strong> MEE AUTO PARTS is not responsible for improper installation or usage, labor charges, loss of income, wages, salary, or car rental charges.
      </p>
    </section>
  );
}

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

const LEGACY_INVOICE_DOCUMENT_CSS = `
  .invoice-document {
    width: 794px;
    color: #56575c;
    font-family: Arial, Helvetica, sans-serif;
    background: transparent;
  }

  .invoice-page {
    position: relative;
    width: 794px;
    min-height: 1123px;
    margin: 0 0 18px;
    padding: 14px 24px 18px;
    overflow: hidden;
    background: #dfdcdd;
    border-top: 10px solid #8f8f8f;
    border-bottom: 10px solid #8f8f8f;
    page-break-after: always;
  }

  .invoice-page:last-child {
    margin-bottom: 0;
  }

  .invoice-header,
  .invoice-company,
  .invoice-address-section,
  .invoice-delivery,
  .invoice-items,
  .invoice-payment-card,
  .invoice-warranty,
  .invoice-signature,
  .invoice-footer {
    position: relative;
    z-index: 1;
  }

  .invoice-header {
    display: grid;
    grid-template-columns: 1fr 330px;
    gap: 22px;
    align-items: start;
  }

  .invoice-logo {
    width: 360px;
    height: auto;
    margin: 0 0 18px 34px;
  }

  .invoice-title-block h1 {
    margin: 0 0 12px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 22px;
    line-height: 1.1;
    font-weight: 800;
    text-align: left;
  }

  .invoice-title-block--warranty h1 {
    margin-top: -2px;
    font-size: 21px;
    text-align: left;
  }

  .invoice-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1.1fr;
    gap: 0;
    font-size: 15px;
  }

  .invoice-meta-grid span,
  .invoice-meta-grid strong {
    min-height: 28px;
    padding: 0 0 8px;
  }

  .invoice-meta-grid span {
    color: #5e6068;
    font-weight: 800;
  }

  .invoice-meta-grid strong {
    color: #5e6068;
    font-weight: 500;
  }

  .invoice-company {
    margin: 6px 22px 10px;
    padding-bottom: 9px;
    border-bottom: 4px solid #9b9b9b;
    color: #4d4d4d;
    font-size: 10px;
    letter-spacing: 0;
  }

  .invoice-address-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 132px;
    padding: 3px 12px 0;
    font-size: 15px;
  }

  .invoice-address-left {
    padding-right: 24px;
  }

  .invoice-address-right {
    border-left: 2px solid #8d8d8d;
    padding-left: 12px;
  }

  .invoice-info-line {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px;
    margin: 0 0 72px;
    line-height: 1.25;
  }

  .invoice-address-right .invoice-info-line {
    margin-bottom: 50px;
  }

  .invoice-payment-card .invoice-info-line {
    grid-template-columns: 118px 1fr;
    margin-bottom: 9px;
    font-size: 13px;
  }

  .invoice-info-line strong {
    color: #4f5157;
    font-weight: 800;
  }

  .invoice-info-line span {
    white-space: pre-wrap;
    color: #5c5d63;
  }

  .invoice-delivery {
    margin: 0;
    padding: 6px 0 10px;
    border-bottom: 4px solid #9b9b9b;
    color: #4f5157;
    font-size: 15px;
    text-align: center;
  }

  .invoice-items {
    display: grid;
    grid-template-columns: 1fr 130px 160px;
    min-height: 136px;
    margin: 8px 0;
    padding: 10px 12px;
    border: 1px solid #111;
    border-radius: 8px;
  }

  .invoice-items h2 {
    margin: 0 0 10px;
    color: #5e6068;
    font-size: 18px;
    line-height: 1;
    font-weight: 800;
  }

  .invoice-items p {
    margin: 0 0 14px;
    color: #66676c;
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
    min-height: 148px;
    padding: 10px 12px;
    border: 1px solid #111;
    border-radius: 8px;
  }

  .invoice-notice {
    margin-top: 20px;
    font-size: 11px;
    color: #444;
  }

  .invoice-notice p {
    display: inline-block;
    margin: 0 0 8px;
    color: #ff1717;
    text-decoration: underline;
  }

  .invoice-notice ul {
    margin: 0;
    padding-left: 20px;
  }

  .invoice-notice li {
    margin: 5px 0;
  }

  .invoice-notice span {
    color: #ff1717;
  }

  .invoice-charges {
    padding: 0 68px 0 28px;
  }

  .invoice-charge-line,
  .invoice-total-row {
    display: grid;
    grid-template-columns: 1fr 90px;
    gap: 10px;
    margin: 0 0 6px;
    align-items: baseline;
  }

  .invoice-charge-line span,
  .invoice-charge-line strong {
    color: #62646a;
    font-size: 14px;
    font-weight: 500;
  }

  .invoice-total-row {
    margin-top: 34px;
  }

  .invoice-total-row span,
  .invoice-total-row strong {
    color: #505258;
    font-size: 16px;
    font-weight: 800;
  }

  .invoice-warranty {
    margin-top: 40px;
    color: #5b5c61;
    font-size: 12.6px;
    line-height: 1.34;
  }

  .invoice-warranty h2 {
    margin: 0 0 28px;
    color: #55565b;
    font-size: 14px;
    font-weight: 800;
  }

  .invoice-warranty h3 {
    margin: 18px 0 2px;
    color: #55565b;
    font-size: 12.8px;
    font-weight: 800;
  }

  .invoice-warranty ul {
    margin: 0;
    padding-left: 14px;
  }

  .invoice-warranty li {
    margin: 1px 0;
  }

  .invoice-warranty p {
    margin: 26px 0 0;
    font-size: 13px;
  }

  .invoice-signature {
    position: absolute;
    right: 10px;
    bottom: 18px;
    z-index: 2;
    width: 300px;
    height: 95px;
  }

  .invoice-signature-label {
    position: absolute;
    right: 180px;
    top: 14px;
    width: 150px;
    color: #17172f;
    font-size: 12px;
    font-weight: 800;
    text-align: right;
  }

  .invoice-signature-box {
    position: absolute;
    right: 0;
    top: 0;
    width: 180px;
    height: 82px;
    border-left: 2px solid #111;
    border-right: 2px solid #111;
  }

  .invoice-signature-line {
    min-height: 50px;
    border-top: 2px solid #111;
    color: #111;
    font-family: "Brush Script MT", cursive;
    font-size: 24px;
    line-height: 50px;
    text-align: center;
  }

  .invoice-signature-line img {
    max-width: 154px;
    max-height: 44px;
    object-fit: contain;
    vertical-align: middle;
  }

  .invoice-signature-date {
    min-height: 30px;
    border-bottom: 2px solid #111;
    color: #111;
    font-size: 12px;
    line-height: 30px;
    text-align: center;
  }

  .invoice-footer {
    position: absolute;
    left: 16px;
    bottom: 8px;
    display: flex;
    gap: 10px;
    align-items: center;
    color: #62666f;
    font-size: 15px;
  }

  @media print {
    body {
      margin: 0;
      background: #dfdcdd;
    }

    .invoice-document {
      width: 794px;
    }

    .invoice-page {
      margin: 0;
    }
  }
`;

const INVOICE_DOCUMENT_CSS = `
  .invoice-document {
    width: 794px;
    color: #56575c;
    font-family: Arial, Helvetica, sans-serif;
    background: transparent;
  }

  .invoice-page {
    position: relative;
    width: 794px;
    height: 1123px;
    margin: 0 0 18px;
    overflow: hidden;
    background: #e5e1e1;
    border-top: 6px solid #9d9d9d;
    page-break-after: always;
  }

  .invoice-page:last-child {
    margin-bottom: 0;
  }

  .invoice-header {
    display: grid;
    grid-template-columns: 1fr 280px;
    column-gap: 26px;
    margin: 18px 24px 0;
    padding-bottom: 10px;
    border-bottom: 3px solid #9c9c9c;
  }

  .invoice-logo-block {
    padding-top: 4px;
    text-align: center;
  }

  .invoice-logo {
    display: block;
    width: 345px;
    height: auto;
    margin: 0 auto 12px;
  }

  .invoice-logo-block p {
    margin: 0;
    color: #6e6e72;
    font-size: 9px;
    letter-spacing: 0.01em;
  }

  .invoice-title-block h1 {
    margin: 0 0 18px;
    color: rgba(255, 255, 255, 0.46);
    font-size: 25px;
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
    text-transform: uppercase;
  }

  .invoice-meta {
    display: grid;
    grid-template-columns: 116px 1fr;
    row-gap: 14px;
    color: #686970;
    font-size: 11px;
    line-height: 1;
  }

  .invoice-meta strong,
  .invoice-label-value strong,
  .invoice-items-header,
  .invoice-total strong:first-child {
    color: #5b5c62;
    font-weight: 900;
  }

  .invoice-address-grid {
    display: grid;
    grid-template-columns: 1fr 2px 1fr;
    gap: 18px;
    min-height: 136px;
    margin: 10px 24px 0;
  }

  .invoice-address-left,
  .invoice-address-right {
    display: grid;
    align-content: start;
    gap: 52px;
    padding: 0 6px;
  }

  .invoice-address-right {
    gap: 12px;
  }

  .invoice-address-divider {
    width: 2px;
    height: 114px;
    margin-top: 18px;
    background: #9c9c9c;
  }

  .invoice-label-value {
    display: grid;
    grid-template-columns: max-content 1fr;
    column-gap: 8px;
    align-items: start;
    min-width: 0;
    font-size: 11px;
    line-height: 1.28;
  }

  .invoice-label-value--inline {
    grid-template-columns: 1fr max-content;
  }

  .invoice-label-value--compact {
    grid-template-columns: 98px 1fr;
    column-gap: 4px;
    font-size: 9px;
    line-height: 1.18;
  }

  .invoice-label-value span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .invoice-delivery {
    margin: 0 24px;
    padding-bottom: 10px;
    border-bottom: 3px solid #9c9c9c;
    color: #67686d;
    font-size: 14px;
    line-height: 1;
  }

  .invoice-items-box,
  .invoice-payment-box {
    margin: 10px 24px 0;
    border: 2px solid #232323;
    border-radius: 10px;
    background: #f9f9f9;
  }

  .invoice-items-box {
    height: 135px;
  }

  .invoice-items-header,
  .invoice-items-row {
    display: grid;
    grid-template-columns: 1fr 78px 170px;
    column-gap: 10px;
    padding: 8px 16px 0;
  }

  .invoice-items-header {
    color: #606168;
    font-size: 17px;
    line-height: 1;
  }

  .invoice-items-header span:nth-child(2),
  .invoice-items-header span:nth-child(3),
  .invoice-items-row p:nth-child(2),
  .invoice-items-row p:nth-child(3) {
    text-align: center;
  }

  .invoice-items-row {
    padding-top: 20px;
    color: #111827;
    font-size: 10px;
    line-height: 1.1;
  }

  .invoice-items-row p {
    margin: 0 0 14px;
  }

  .invoice-payment-box {
    display: grid;
    grid-template-columns: 1fr 300px;
    min-height: 135px;
    padding: 8px 16px 10px;
  }

  .invoice-payment-info {
    min-width: 0;
  }

  .invoice-charge-info {
    padding-left: 20px;
    color: #66676d;
    font-size: 13px;
  }

  .invoice-charge-line {
    display: grid;
    grid-template-columns: 1fr 76px;
    margin: 0 0 6px;
    line-height: 1;
  }

  .invoice-extra-notice {
    margin-top: 18px;
    color: #55575d;
    font-size: 8.5px;
    line-height: 1.3;
  }

  .invoice-extra-notice p {
    margin: 0 0 8px;
    color: #ff1f28;
    font-size: 10.5px;
    text-decoration: underline;
  }

  .invoice-extra-notice ul {
    margin: 0;
    padding-left: 16px;
  }

  .invoice-extra-notice li {
    margin-bottom: 4px;
  }

  .invoice-extra-notice span {
    color: #ff1f28;
  }

  .invoice-total {
    display: grid;
    grid-template-columns: 1fr 86px;
    margin-top: 40px;
    color: #4f5056;
    font-size: 12px;
  }

  .invoice-total strong:first-child {
    font-size: 15px;
  }

  .invoice-signature-area {
    position: absolute;
    right: 18px;
    bottom: 22px;
    display: grid;
    grid-template-columns: 170px 185px;
    align-items: start;
    color: #17172f;
  }

  .invoice-signature-area > strong {
    padding-top: 13px;
    text-align: right;
    font-size: 12px;
    font-weight: 900;
  }

  .invoice-signature-box {
    height: 82px;
    border-left: 3px solid #111;
    border-right: 3px solid #111;
  }

  .invoice-signature-line {
    height: 50px;
    border-top: 3px solid #111;
    color: #111;
    font-family: "Brush Script MT", cursive;
    font-size: 24px;
    line-height: 50px;
    text-align: center;
  }

  .invoice-signature-line img {
    max-width: 154px;
    max-height: 44px;
    object-fit: contain;
    vertical-align: middle;
  }

  .invoice-signature-date {
    height: 30px;
    border-bottom: 3px solid #111;
    color: #111;
    font-size: 12px;
    line-height: 30px;
    text-align: center;
  }

  .invoice-footer {
    position: absolute;
    left: 16px;
    bottom: 12px;
    display: flex;
    gap: 10px;
    align-items: center;
    color: #62666f;
    font-size: 16px;
  }

  .invoice-warranty {
    margin: 48px 42px 0;
    color: #5b5c61;
    font-size: 13px;
    line-height: 1.38;
  }

  .invoice-warranty h2 {
    margin: 0 0 30px;
    color: #55565b;
    font-size: 14px;
    font-weight: 900;
  }

  .invoice-warranty h3 {
    margin: 18px 0 3px;
    color: #55565b;
    font-size: 13px;
    font-weight: 900;
  }

  .invoice-warranty ul {
    margin: 0;
    padding-left: 16px;
  }

  .invoice-warranty li {
    margin: 2px 0;
  }

  .invoice-warranty p {
    margin: 28px 0 0;
  }

  @media print {
    body {
      margin: 0;
      background: #e5e1e1;
    }

    .invoice-document {
      width: 794px;
      max-width: none;
    }

    .invoice-page {
      margin: 0;
      break-after: page;
      page-break-after: always;
    }

    .invoice-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
  }
`;