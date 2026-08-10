'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronDown, Clock3, Copy, Download, Eye, FileText, Fingerprint, LoaderCircle, Paperclip, Pencil, Send, ShieldCheck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { invoicesApi } from '@/features/invoices/api/invoices-api';
import type {
  CreateInvoiceInput,
  InvoiceDefaults,
  InvoiceRecord,
  InvoiceSignatureRequestResult,
} from '@/features/invoices/types/invoice.types';
import type { OrderDetail } from '@/features/orders/types/order.types';
import { formatUsPhoneNumber } from '@/lib/forms/phone-format';
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
  warrantyPartsOnly: string;
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
  photoIdRequired: boolean;
};

const DEFAULT_WARRANTY_PARTS_ONLY = [
  'Standard: 90 days for non-performance engines and transmissions.',
  "No Warranty: Rotary engines, engine accessories (alternator, turbocharger, sensors), and labor - any accesories sent isn't charged or covered.",
  'Voided Warranty: Overheating, abuse, improper installation, or failure to install a new timing belt/tensioner and/or accesories.',
  'Coverage: Engines are guaranteed against rod knock, cracked blocks, and internal issues.',
  'Warranty is void if the part requires modifications to fit or if it necessitates alterations or replacement of other components.',
].join('\n');

export function InvoiceActions({
  order,
  onInvoiceCreated,
}: {
  order: OrderDetail;
  onInvoiceCreated: () => void;
}) {
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(order.invoice);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [isCloningInvoice, setIsCloningInvoice] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isPhotoIdOpen, setIsPhotoIdOpen] = useState(false);
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSignatureActionRunning, setIsSignatureActionRunning] = useState(false);
  const authUser = useAuthStore((state) => state.user);
  const printableInvoiceRef = useRef<HTMLDivElement>(null);
  const canManageSignatureRequest =
    authUser?.role === 'ADMIN' || authUser?.role === 'SALES';

  useEffect(() => {
    setInvoice(order.invoice);
  }, [order.invoice]);

  useEffect(() => {
    if (!order.invoice) {
      return;
    }

    let isCurrent = true;

    invoicesApi
      .getByOrderId(order.id)
      .then((hydratedInvoice) => {
        if (isCurrent) {
          setInvoice(hydratedInvoice);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setInvoice(order.invoice);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [order.id, order.invoice]);

  const printableInvoice = invoice ?? (draft ? draftToInvoicePreview(order.id, draft) : null);

  const totalAmount = useMemo(() => {
    if (!draft) {
      return 0;
    }

    return calculateInvoiceTotal(draft);
  }, [draft]);

  const openGenerateModal = async () => {
    if (order.status === 'PARTIALLY_PAID') {
      toast.error(
        'Invoice cannot be generated',
        'This order is still partially paid.',
      );
      return;
    }

    setIsLoadingDefaults(true);
    setFormError(null);
    setIsEditingInvoice(false);
    setIsCloningInvoice(false);

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

  const openEditModal = () => {
    if (!invoice) {
      return;
    }

    if (invoice.status === 'SIGNED') {
      toast.error('Invoice is locked', 'Signed invoices cannot be edited.');
      return;
    }

    setDraft(invoiceToDraft(invoice));
    setFormError(null);
    setIsEditingInvoice(true);
    setIsCloningInvoice(false);
    setIsGenerateOpen(true);
  };

  const openCloneModal = () => {
    if (!invoice) {
      return;
    }

    if (invoice.status !== 'SIGNED') {
      toast.error('Invoice is not signed', 'Only signed invoices can be cloned.');
      return;
    }

    setDraft(invoiceToCloneDraft(invoice));
    setFormError(null);
    setIsEditingInvoice(false);
    setIsCloningInvoice(true);
    setIsGenerateOpen(true);
  };

  const handleSaveInvoice = async () => {
    if (!draft) {
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const payload = draftToPayload(draft);
      const savedInvoice = isCloningInvoice
        ? await invoicesApi.cloneSignedInvoice(order.id, payload)
        : isEditingInvoice
          ? await invoicesApi.update(order.id, payload)
          : await invoicesApi.create(order.id, payload);
      setInvoice(savedInvoice);
      setIsGenerateOpen(false);
      setIsEditingInvoice(false);
      setIsCloningInvoice(false);
      setIsViewOpen(true);
      onInvoiceCreated();
      if (isCloningInvoice) {
        toast.success(
          'Invoice cloned',
          getSignatureRequestToastMessage(savedInvoice),
        );
      } else if (isEditingInvoice) {
        toast.success(
          'Invoice updated',
          'The sent signing link now shows the corrected invoice.',
        );
      } else {
        toast.success(
          'Invoice generated',
          savedInvoice.status === 'SIGNATURE_REQUESTED'
            ? getSignatureRequestToastMessage(savedInvoice)
            : 'The invoice is now linked to this order.',
        );
      }
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : isEditingInvoice
            ? 'Unable to update this invoice.'
            : isCloningInvoice
              ? 'Unable to clone this invoice.'
            : 'Unable to generate this invoice.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignatureAction = async () => {
    setIsSignatureActionRunning(true);

    try {
      const updatedInvoice = await invoicesApi.resendSignatureRequest(order.id);
      setInvoice(updatedInvoice);
      onInvoiceCreated();
      toast.success(
        'Signature request sent',
        getSignatureRequestToastMessage(updatedInvoice),
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

  const handleDownloadInvoice = async () => {
    if (!printableInvoiceRef.current) {
      toast.error('Invoice not ready', 'Open or generate the invoice and try again.');
      return;
    }

    setIsDownloading(true);

    try {
      await downloadInvoicePdf(
        printableInvoiceRef.current,
        `${printableInvoice?.invoiceNumber ?? order.orderNumber}-invoice`,
      );
    } catch (caughtError) {
      toast.error(
        'Unable to download invoice',
        caughtError instanceof Error
          ? caughtError.message
          : 'Please try again in a moment.',
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-4 w-4 text-primary" />
              Invoice Management
            </CardTitle>
            <CardDescription className="text-sm">
              Generate, view, and download the purchase invoice.
            </CardDescription>
          </div>
          <Link
            href="/orders"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'h-8 shrink-0 rounded-full px-3 text-xs',
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to orders
          </Link>
        </CardHeader>
        <CardContent className="space-y-3 pt-1">
          {invoice ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {invoice.status === 'SIGNED' ? 'Signed' : 'Invoiced'}
                </Badge>
                <Button type="button" size="sm" variant="outline" onClick={() => setIsViewOpen(true)}>
                  <Eye className="h-4 w-4" />
                  {invoice.status === 'SIGNED' ? 'View Signed Invoice' : 'View Invoice'}
                </Button>
                <Button type="button" size="sm" disabled={isDownloading} onClick={() => void handleDownloadInvoice()}>
                  {isDownloading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isDownloading
                    ? 'Downloading...'
                    : invoice.status === 'SIGNED'
                      ? 'Download Signed Invoice'
                      : 'Download Invoice (PDF)'}
                </Button>
                {invoice.photoIdDocument ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsPhotoIdOpen(true)}
                    >
                      <Eye className="h-4 w-4" />
                      View Photo ID
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => downloadPhotoIdDocument(invoice)}
                    >
                      <Download className="h-4 w-4" />
                      Download Photo ID
                    </Button>
                  </>
                ) : null}
                {invoice.status === 'SIGNED' && canManageSignatureRequest ? (
                  <Button
                    type="button"
                    size="sm"
                  variant="outline"
                  onClick={openCloneModal}
                >
                  <Copy className="h-4 w-4" />
                  Clone Invoice
                </Button>
                ) : null}
                {invoice.status !== 'SIGNED' && canManageSignatureRequest ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={openEditModal}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit Invoice
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSignatureActionRunning}
                      onClick={() => void handleSignatureAction()}
                    >
                      {isSignatureActionRunning ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                    )}
                    Resend Signature Request
                  </Button>
                </>
              ) : null}
              </div>
              <InvoiceAuditTrailPanel invoice={invoice} />
            </>
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
          mode={isCloningInvoice ? 'clone' : isEditingInvoice ? 'edit' : 'create'}
          totalAmount={totalAmount}
          onChange={setDraft}
          onClose={() => {
            setIsGenerateOpen(false);
            setIsEditingInvoice(false);
            setIsCloningInvoice(false);
          }}
          onSubmit={handleSaveInvoice}
        />
      ) : null}

      {isViewOpen && invoice ? (
        <InvoiceViewModal
          invoice={invoice}
          onClose={() => setIsViewOpen(false)}
          onDownload={handleDownloadInvoice}
          isDownloading={isDownloading}
        />
      ) : null}

      {isPhotoIdOpen && invoice?.photoIdDocument ? (
        <PhotoIdViewModal
          invoice={invoice}
          onClose={() => setIsPhotoIdOpen(false)}
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

function InvoiceAuditTrailPanel({ invoice }: { invoice: InvoiceRecord }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuditDownloading, setIsAuditDownloading] = useState(false);
  const auditTrail = invoice.auditTrail;
  const timestamps = auditTrail?.timestamps ?? [];
  const attachmentDetails = auditTrail?.attachmentDetails;
  const events = auditTrail?.events ?? [];
  const latestEvent = events[0];

  const handleDownloadAuditTrail = async () => {
    setIsAuditDownloading(true);

    try {
      await downloadAuditTrailPdf(invoice);
    } catch (caughtError) {
      toast.error(
        'Unable to download audit trail',
        caughtError instanceof Error
          ? caughtError.message
          : 'Please try again in a moment.',
      );
    } finally {
      setIsAuditDownloading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none transition hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-primary/30"
          onClick={() => setIsOpen((currentValue) => !currentValue)}
          aria-expanded={isOpen}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            Audit Trail
          </h3>
            <p className="truncate text-xs text-slate-500">
              {latestEvent
                ? `Latest: ${latestEvent.title} - ${formatPdtDateTime(latestEvent.occurredAt)}`
                : 'Legal activity log shown in PDT timezone.'}
            </p>
          </span>
          <ChevronDown
            className={cn(
              'ml-auto h-4 w-4 shrink-0 text-slate-500 transition-transform',
              isOpen ? 'rotate-180' : '',
            )}
          />
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="rounded-full text-[11px]">
            {events.length} events
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isAuditDownloading}
            onClick={() => void handleDownloadAuditTrail()}
          >
            {isAuditDownloading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Audit PDF
          </Button>
        </div>
      </div>

      {isOpen ? (
      <div className="grid gap-3 border-t border-slate-200/80 p-3 pt-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <div className="rounded-xl border border-white bg-white/85 p-3 shadow-sm">
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              Timestamps
            </h4>
            {timestamps.length > 0 ? (
              <div className="space-y-1.5 text-sm text-slate-700">
                {timestamps.map((timestamp) => (
                  <div key={`${timestamp.label}-${timestamp.occurredAt}`}>
                    {formatPdtDateTime(timestamp.occurredAt)} - {timestamp.label}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No sent, viewed, or signed timestamp yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-white bg-white/85 p-3 shadow-sm">
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Paperclip className="h-3.5 w-3.5" />
              Attachment Details
            </h4>
            {attachmentDetails ? (
              <div className="space-y-2 text-sm text-slate-700">
                <AuditDetail label="Document Title" value={attachmentDetails.documentTitle} />
                <AuditDetail
                  label="File"
                  value={attachmentDetails.fileName ?? 'Uploaded document'}
                />
                <AuditDetail
                  label="Uploaded"
                  value={
                    attachmentDetails.uploadedAt
                      ? formatPdtDateTime(attachmentDetails.uploadedAt)
                      : 'Pending'
                  }
                />
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Fingerprint className="h-3.5 w-3.5" />
                    Hash
                  </div>
                  <p className="break-all rounded-lg bg-slate-100 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-slate-700">
                    {attachmentDetails.hash}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No Photo ID attachment uploaded yet.</p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {events.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="grid gap-0 sm:grid-cols-[150px_1fr]"
                >
                  <div className="bg-slate-50 px-3 py-2">
                    <div className="text-sm font-semibold text-slate-800">
                      {event.title}:
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {formatPdtDateTime(event.occurredAt)}
                    </div>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-sm text-slate-700">{event.description}</p>
                    <div className="mt-2 grid gap-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500 sm:grid-cols-2">
                      <span>{formatAuditActor(event)}</span>
                      <span>{event.ipAddress ? `IP: ${event.ipAddress}` : 'IP: Not captured'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-slate-500">
              Audit events will appear after the invoice is sent, viewed, edited, signed, or completed.
            </div>
          )}
        </div>
      </div>
      ) : null}
    </div>
  );
}

function AuditDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="text-sm text-slate-800">{value}</div>
    </div>
  );
}

function InvoiceFormModal({
  draft,
  error,
  isSaving,
  mode,
  totalAmount,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: InvoiceDraft;
  error: string | null;
  isSaving: boolean;
  mode: 'create' | 'edit' | 'clone';
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

  const updateBooleanField = (field: 'photoIdRequired', value: boolean) => {
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
              {mode === 'edit'
                ? 'Edit Invoice'
                : mode === 'clone'
                  ? 'Clone Invoice'
                  : 'Generate Invoice'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === 'edit'
                ? 'Update the saved invoice before the customer signs it.'
                : mode === 'clone'
                  ? 'Previous invoice details are copied. Review, edit, and generate a new signing request.'
                : 'Prefilled from the order. All values can be edited before saving.'}
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
              <InvoiceSelect
                label="Photo ID"
                value={draft.photoIdRequired ? 'required' : 'not-required'}
                options={[
                  { label: 'Required', value: 'required' },
                  { label: 'Not required', value: 'not-required' },
                ]}
                onChange={(value) => updateBooleanField('photoIdRequired', value === 'required')}
              />
            </InvoiceFormSection>

            <InvoiceFormSection title="Customer Information">
              <InvoiceInput label="Customer Name" value={draft.customerName} onChange={(value) => updateField('customerName', value)} />
              <InvoiceInput
                label="Contact Number"
                type="tel"
                maxLength={14}
                value={draft.contactNumber}
                onChange={(value) => updateField('contactNumber', formatUsPhoneNumber(value))}
              />
              <InvoiceTextarea label="Billing Address" value={draft.billingAddress} onChange={(value) => updateField('billingAddress', value)} />
            </InvoiceFormSection>

            <InvoiceFormSection title="Shipping Information">
              <InvoiceTextarea label="Shipping Address" value={draft.shippingAddress} onChange={(value) => updateField('shippingAddress', value)} />
              <InvoiceInput label="Shipping Vendor" value={draft.shippingVendor} onChange={(value) => updateField('shippingVendor', value)} />
              <InvoiceInput label="Delivery Timeline" value={draft.deliveryTimeline} onChange={(value) => updateField('deliveryTimeline', value)} />
            </InvoiceFormSection>

            <InvoiceFormSection title="Product Information">
              <InvoiceTextarea label="Item Description" value={draft.itemDescription} onChange={(value) => updateField('itemDescription', value)} />
              <InvoiceInput label="Quantity" type="number" min="1" value={draft.quantity} onChange={(value) => updateField('quantity', value)} />
              <InvoiceInput label="Sale Amount" type="number" step="0.01" value={draft.saleAmount} onChange={(value) => updateField('saleAmount', value)} />
            </InvoiceFormSection>

            <InvoiceFormSection title="Warranty Terms">
              <InvoiceTextarea
                label="Warranty ( parts only )"
                value={draft.warrantyPartsOnly}
                onChange={(value) => updateField('warrantyPartsOnly', value)}
              />
            </InvoiceFormSection>

            <InvoiceFormSection title="Payment Information">
              <InvoiceInput label="Payment Status" value={draft.paymentStatus} onChange={(value) => updateField('paymentStatus', value)} />
              <InvoiceInput label="Payment Date" type="date" value={draft.paymentDate} onChange={(value) => updateField('paymentDate', value)} />
              <InvoiceInput label="Payment Source" value={draft.paymentSource} onChange={(value) => updateField('paymentSource', value)} placeholder="Card ending. ****xxxx" />
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
                    {mode === 'edit' ? 'Saving...' : 'Generating...'}
                  </>
                ) : (
                  mode === 'edit' ? 'Save Changes' : 'Generate Invoice'
                )}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>

          <div className="rounded-3xl border border-border/70 bg-secondary/20 p-3">
            <p className="mb-3 text-sm font-semibold text-muted-foreground">Live Preview</p>
            <div className="max-h-[78vh] overflow-auto rounded-2xl bg-white p-3">
              <div className="mx-auto w-[381px] max-w-full">
                <div className="h-[1096px] w-[381px] max-w-full overflow-hidden">
                  <div className="origin-top-left scale-[0.48]">
                    <InvoiceDocument invoice={draftToInvoicePreview('preview', draft)} />
                  </div>
                </div>
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
  isDownloading,
}: {
  invoice: InvoiceRecord;
  onClose: () => void;
  onDownload: () => Promise<void>;
  isDownloading: boolean;
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
              {invoice.invoiceNumber} · generated {formatDisplayDate(invoice.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={isDownloading} onClick={() => void onDownload()}>
              {isDownloading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isDownloading ? 'Downloading...' : 'Download PDF'}
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

function PhotoIdViewModal({
  invoice,
  onClose,
}: {
  invoice: InvoiceRecord;
  onClose: () => void;
}) {
  const photoIdDocument = invoice.photoIdDocument;
  const mimeType = invoice.photoIdMimeType ?? '';
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoIdDocument) {
      return;
    }

    const blob = dataUrlToBlob(photoIdDocument);
    const objectUrl = URL.createObjectURL(blob);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [photoIdDocument]);

  if (!photoIdDocument) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-[2rem] border border-white/70 bg-white p-5 shadow-2xl shadow-slate-950/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
          <div>
            <h2 className="font-[var(--font-heading)] text-2xl font-semibold text-foreground">
              Photo ID
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {invoice.photoIdFileName || `${invoice.invoiceNumber}-photo-id`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => downloadPhotoIdDocument(invoice)}>
              <Download className="h-4 w-4" />
              Download Photo ID
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
        <div className="max-h-[78vh] overflow-auto rounded-2xl bg-slate-100 p-4">
          {mimeType === 'application/pdf' || photoIdDocument.startsWith('data:application/pdf') ? (
            <iframe
              src={previewUrl ?? photoIdDocument}
              title="Uploaded photo ID"
              className="h-[72vh] w-full rounded-xl border border-border bg-white"
            />
          ) : (
            <img
              src={previewUrl ?? photoIdDocument}
              alt="Uploaded photo ID"
              className="mx-auto max-h-[72vh] max-w-full rounded-xl bg-white object-contain shadow-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export const InvoiceDocument = forwardRef<HTMLDivElement, { invoice: InvoiceRecord }>(
function InvoiceDocument({ invoice }, ref) {
  const shippingAddress = splitShippingAddress(invoice.shippingAddress);

  return (
  <div ref={ref} className="invoice-document">
    <style>{INVOICE_DOCUMENT_CSS}</style>
    <div className="invoice-page invoice-page--purchase">
      <InvoiceWatermark />
      <InvoiceTemplateHeader invoice={invoice} title="PURCHASE INVOICE" showMeta />

      <section className="invoice-address-panel">
        <div className="invoice-address-cell invoice-address-cell--shipping">
          <p>
            <strong>Shipping Address :</strong>
            <span className="invoice-shipping-address">
              {shippingAddress.businessName ? <b>{shippingAddress.businessName}</b> : null}
              {shippingAddress.businessAddress ? <span>{shippingAddress.businessAddress}</span> : null}
            </span>
          </p>
          <p>
            <strong>Shipping Vendor :</strong>
            <span>{invoice.shippingVendor || 'LTL'}</span>
          </p>
        </div>
        <div className="invoice-address-divider" />
        <div className="invoice-address-cell invoice-address-cell--customer">
          <p>
            <strong>Customer Name :</strong>
            <span>{invoice.customerName || ''}</span>
          </p>
          <p>
            <strong>Billing Address :</strong>
            <span>{invoice.billingAddress || ''}</span>
          </p>
          <p>
            <strong>Contact Number :</strong>
            <span>{invoice.contactNumber || ''}</span>
          </p>
        </div>
      </section>

      <p className="invoice-delivery-note">
        Delivery timeline is {invoice.deliveryTimeline}, may vary due to distance and shipping vendor
      </p>

      <section className="invoice-item-box">
        <div className="invoice-table-head">
          <strong>Item Descriptions</strong>
          <strong>Qty</strong>
          <strong>Amount</strong>
        </div>
        <div className="invoice-table-row">
          <span>{invoice.itemDescription}</span>
          <span>{invoice.quantity}</span>
          <span>{formatMoney(invoice.saleAmount)}</span>
        </div>
      </section>

      <section className="invoice-payment-box">
        <div className="invoice-payment-summary">
          <p>
            <strong>Payment Status</strong>
            <span>{invoice.paymentStatus || ''}</span>
          </p>
          <p>
            <strong>Date</strong>
            <span>{invoice.paymentDate ? formatInvoiceDate(invoice.paymentDate) : ''}</span>
          </p>
          <p>
            <strong>Payment Source</strong>
            <span>{invoice.paymentSource || ''}</span>
          </p>
        </div>
        <div className="invoice-charge-summary">
          <p>
            <span>Shipping Cost</span>
            <span>{formatMoney(invoice.shippingCost)}</span>
          </p>
          <p>
            <span>Sales Taxes</span>
            <span>{formatMoney(invoice.salesTaxes)}</span>
          </p>
          <p>
            <span>Core Charge</span>
            <span>{formatMoney(invoice.coreCharge)}</span>
          </p>
          <p className="invoice-total-line">
            <strong>TOTAL</strong>
            <strong>{formatMoney(invoice.totalAmount)}</strong>
          </p>
        </div>
        <div className="invoice-additional-charges">
          <p>Additional charges will be applicable :</p>
          <ul>
            <li>
              If <strong>unloading equipment</strong> is unavailable at the time of delivery (Freight&apos;s only)
            </li>
            <li>
              <strong>Reschedule delivery</strong> (Missed or reattempt delivery)
            </li>
          </ul>
        </div>
      </section>
      <InvoiceSignature invoice={invoice} />
      <InvoiceFooter />
    </div>

    <div className="invoice-page invoice-page--warranty">
      <InvoiceWatermark />
      <InvoiceTemplateHeader invoice={invoice} title="WARRANTY - TERMS & CONDITION" />
      <WarrantyTerms warrantyPartsOnly={invoice.warrantyPartsOnly} />
      <div className="invoice-acceptance-box">
        <strong>Acceptance:</strong>
        <span>
          I have read, understood, and agree to these terms. Signing confirms
          proper installation and maintenance compliance.
        </span>
      </div>
      <p className="invoice-warranty-note">
        <strong>Note :</strong> MEE AUTO PARTS is not responsible for improper
        installation or usage, labor charges, loss of income, wages, salary, or
        car rental
      </p>
      {invoice.photoIdRequired ? (
        <div className="invoice-photo-id-pill">Photo ID - Front copy - Attachment</div>
      ) : null}
      <InvoiceSignature invoice={invoice} />
      <InvoiceFooter />
    </div>
  </div>
  );
});

function InvoiceValue({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return <div className={cn('invoice-field-value', className)}>{children}</div>;
}

function InvoiceTemplateHeader({
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
        <img className="invoice-logo" src="/images/invoice-logo.png" alt="MEE Auto Parts" />
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

function InvoiceWatermark() {
  return (
    <img
      className="invoice-watermark"
      src="/images/invoice-template/mee-auto-parts-watermark.png"
      alt=""
    />
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
      <span className="invoice-signature-label">Customer Signature:</span>
      <div className="invoice-signature-image">
          {invoice.customerSignatureImage ? (
            <img src={invoice.customerSignatureImage} alt="Customer signature" />
          ) : (
            invoice.customerSignature || ''
          )}
      </div>
      <span className="invoice-signature-date-label">Date:</span>
      <span className="invoice-signature-date">
        {invoice.signatureDate ? formatSignatureDate(invoice.signatureDate) : ''}
      </span>
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

function WarrantyTerms({
  warrantyPartsOnly,
}: {
  warrantyPartsOnly?: string | null;
}) {
  const warrantyLines = parseWarrantyLines(warrantyPartsOnly);

  return (
    <section className="invoice-warranty">
      <h2>Warranty | Returns | Cancellation</h2>

      <h3>Warranty ( parts only )</h3>
      <ul>
        {warrantyLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
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

function InvoiceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-input bg-white px-4 py-2.5 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
    contactNumber: formatUsPhoneNumber(defaults.contactNumber),
    warrantyPartsOnly: defaults.warrantyPartsOnly || DEFAULT_WARRANTY_PARTS_ONLY,
    quantity: String(defaults.quantity),
    saleAmount: formatNumberInput(defaults.saleAmount),
    shippingCost: formatNumberInput(defaults.shippingCost),
    salesTaxes: formatNumberInput(defaults.salesTaxes),
    coreCharge: formatNumberInput(defaults.coreCharge),
  };
}

function getSignatureRequestToastMessage(
  invoice: InvoiceSignatureRequestResult,
): string {
  if (invoice.signatureSmsStatus === 'SENT') {
    return 'Email sent and SMS sent';
  }

  if (invoice.signatureSmsStatus === 'SKIPPED') {
    return `Email sent, SMS skipped: ${
      invoice.signatureSmsMessage || 'no phone number'
    }`;
  }

  if (invoice.signatureSmsStatus === 'FAILED') {
    return 'Email sent, SMS failed: check logs/RingCentral';
  }

  return 'Email sent';
}

function invoiceToDraft(invoice: InvoiceRecord): InvoiceDraft {
  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: formatDateInputValue(invoice.invoiceDate),
    salesAssistant: invoice.salesAssistant ?? '',
    customerName: invoice.customerName,
    contactNumber: formatUsPhoneNumber(invoice.contactNumber ?? ''),
    billingAddress: invoice.billingAddress ?? '',
    shippingAddress: invoice.shippingAddress ?? '',
    shippingVendor: invoice.shippingVendor,
    deliveryTimeline: invoice.deliveryTimeline,
    itemDescription: invoice.itemDescription,
    vehiclePartDescription: invoice.vehiclePartDescription ?? '',
    warrantyPartsOnly: invoice.warrantyPartsOnly ?? DEFAULT_WARRANTY_PARTS_ONLY,
    quantity: String(invoice.quantity),
    saleAmount: formatNumberInput(invoice.saleAmount),
    paymentStatus: invoice.paymentStatus ?? '',
    paymentDate: formatDateInputValue(invoice.paymentDate),
    paymentSource: invoice.paymentSource ?? '',
    shippingCost: formatNumberInput(invoice.shippingCost),
    salesTaxes: formatNumberInput(invoice.salesTaxes),
    coreCharge: formatNumberInput(invoice.coreCharge),
    customerSignature: invoice.customerSignature ?? '',
    customerSignatureImage: invoice.customerSignatureImage ?? '',
    signatureDate: formatDateInputValue(invoice.signatureDate),
    photoIdRequired: invoice.photoIdRequired,
  };
}

function invoiceToCloneDraft(invoice: InvoiceRecord): InvoiceDraft {
  return {
    ...invoiceToDraft(invoice),
    customerSignature: '',
    customerSignatureImage: '',
    signatureDate: '',
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
    vehiclePartDescription: '',
    warrantyPartsOnly: draft.warrantyPartsOnly,
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
    photoIdRequired: draft.photoIdRequired,
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
    vehiclePartDescription: null,
    warrantyPartsOnly: draft.warrantyPartsOnly || DEFAULT_WARRANTY_PARTS_ONLY,
    paymentStatus: draft.paymentStatus || null,
    paymentDate: draft.paymentDate || null,
    paymentSource: draft.paymentSource || null,
    customerSignature: draft.customerSignature || null,
    customerSignatureImage: draft.customerSignatureImage || null,
    signatureDate: draft.signatureDate || null,
    photoIdRequired: draft.photoIdRequired,
    photoIdDocument: null,
    photoIdFileName: null,
    photoIdMimeType: null,
    photoIdUploadedAt: null,
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
  return (
    toAmount(draft.saleAmount) +
    toAmount(draft.shippingCost) +
    toAmount(draft.salesTaxes) +
    toAmount(draft.coreCharge)
  );
}

function toAmount(value: string): number {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatNumberInput(value: number): string {
  return value.toFixed(2);
}

function formatDateInputValue(value: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function parseWarrantyLines(value?: string | null): string[] {
  const source = value?.trim() ? value : DEFAULT_WARRANTY_PARTS_ONLY;

  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitShippingAddress(value?: string | null): {
  businessName: string;
  businessAddress: string;
} {
  const lines = (value ?? '')
    .split(/\r?\n/)
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

function formatPdtDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)} PDT`;
}

function formatAuditActor(
  event: NonNullable<InvoiceRecord['auditTrail']>['events'][number],
): string {
  const identity = [event.actorEmail, event.actorPhone].filter(Boolean).join(' / ');

  if (event.actorName && identity) {
    return `${event.actorName} (${identity})`;
  }

  return event.actorName ?? (identity || 'System');
}

async function downloadAuditTrailPdf(invoice: InvoiceRecord) {
  const auditTrail = invoice.auditTrail;
  const timestamps = auditTrail?.timestamps ?? [];
  const attachmentDetails = auditTrail?.attachmentDetails;
  const events = auditTrail?.events ?? [];
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensurePageSpace = (height: number) => {
    if (y + height <= pageHeight - margin) {
      return;
    }

    pdf.addPage();
    y = margin;
  };

  const drawSectionTitle = (title: string) => {
    ensurePageSpace(30);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(30, 41, 59);
    pdf.text(title, margin, y);
    y += 18;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 14;
  };

  const drawText = (
    text: string,
    options: { size?: number; style?: 'normal' | 'bold'; color?: [number, number, number]; indent?: number } = {},
  ) => {
    const indent = options.indent ?? 0;
    const lines = pdf.splitTextToSize(text || '-', contentWidth - indent);
    ensurePageSpace(lines.length * 14 + 4);
    pdf.setFont('helvetica', options.style ?? 'normal');
    pdf.setFontSize(options.size ?? 10);
    pdf.setTextColor(...(options.color ?? [51, 65, 85]));
    pdf.text(lines, margin + indent, y);
    y += lines.length * 14 + 4;
  };

  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Invoice Audit Trail', margin, y);
  y += 24;
  drawText(`Invoice Number: ${invoice.invoiceNumber}`, { style: 'bold' });
  drawText(`Customer: ${invoice.customerName}`);
  drawText(`Generated: ${formatPdtDateTime(invoice.createdAt)}`);
  y += 8;

  drawSectionTitle('Timestamps');
  if (timestamps.length > 0) {
    timestamps.forEach((timestamp) => {
      drawText(`${formatPdtDateTime(timestamp.occurredAt)} - ${timestamp.label}`);
    });
  } else {
    drawText('No sent, viewed, or signed timestamp captured yet.', {
      color: [100, 116, 139],
    });
  }
  y += 8;

  drawSectionTitle('Attachment Details');
  if (attachmentDetails) {
    drawText('Document Title', { style: 'bold' });
    drawText(attachmentDetails.documentTitle, { indent: 14 });
    drawText('File', { style: 'bold' });
    drawText(attachmentDetails.fileName ?? 'Uploaded document', { indent: 14 });
    drawText('Uploaded', { style: 'bold' });
    drawText(
      attachmentDetails.uploadedAt
        ? formatPdtDateTime(attachmentDetails.uploadedAt)
        : 'Pending',
      { indent: 14 },
    );
    drawText('Hash', { style: 'bold' });
    drawText(attachmentDetails.hash, {
      indent: 14,
      size: 8,
      color: [71, 85, 105],
    });
  } else {
    drawText('No Photo ID attachment uploaded yet.', {
      color: [100, 116, 139],
    });
  }
  y += 8;

  drawSectionTitle('Audit Trail');
  if (events.length > 0) {
    events.forEach((event) => {
      ensurePageSpace(74);
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, y, contentWidth, 62, 6, 6, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`${event.title}:`, margin + 12, y + 17);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(formatPdtDateTime(event.occurredAt), margin + 12, y + 31);
      pdf.setFontSize(9);
      pdf.text(formatAuditActor(event), margin + 12, y + 45);
      pdf.text(event.ipAddress ? `IP: ${event.ipAddress}` : 'IP: Not captured', margin + 12, y + 57);

      const descriptionLines = pdf.splitTextToSize(event.description, contentWidth - 190);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(51, 65, 85);
      pdf.text(descriptionLines.slice(0, 3), margin + 170, y + 19);
      y += 74;
    });
  } else {
    drawText('No audit events captured yet.', {
      color: [100, 116, 139],
    });
  }

  const objectUrl = URL.createObjectURL(pdf.output('blob'));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${sanitizePdfFilename(invoice.invoiceNumber)}-audit-trail.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function createInvoicePdfBlob(invoiceElement: HTMLElement) {
  const pages = Array.from(invoiceElement.querySelectorAll<HTMLElement>('.invoice-page'));

  if (pages.length === 0) {
    throw new Error('Invoice pages are not ready.');
  }

  await waitForInvoiceAssets(invoiceElement);

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (const [pageIndex, page] of pages.entries()) {
    const canvas = await html2canvas(page, {
      backgroundColor: '#e5e1e1',
      height: 1123,
      logging: false,
      scale: 2,
      useCORS: true,
      width: 794,
      windowHeight: 1123,
      windowWidth: 794,
    });
    const imageData = canvas.toDataURL('image/png');

    if (pageIndex > 0) {
      pdf.addPage();
    }

    pdf.addImage(imageData, 'PNG', 0, 0, pageWidth, pageHeight);
  }

  return pdf.output('blob');
}

async function downloadInvoicePdf(invoiceElement: HTMLElement, filename: string) {
  const pdfBlob = await createInvoicePdfBlob(invoiceElement);
  const objectUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = `${sanitizePdfFilename(filename)}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function downloadPhotoIdDocument(invoice: InvoiceRecord) {
  if (!invoice.photoIdDocument) {
    toast.error('Photo ID unavailable', 'No uploaded photo ID was found.');
    return;
  }

  const blob = dataUrlToBlob(invoice.photoIdDocument);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download =
    invoice.photoIdFileName || buildPhotoIdFilename(invoice);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [metadata = '', base64Data = ''] = dataUrl.split(',');
  const mimeTypeMatch = metadata.match(/^data:([^;]+);base64$/);
  const mimeType = mimeTypeMatch?.[1] ?? 'application/octet-stream';
  const binaryString = window.atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function buildPhotoIdFilename(invoice: InvoiceRecord): string {
  const extension =
    invoice.photoIdMimeType === 'application/pdf'
      ? 'pdf'
      : invoice.photoIdMimeType?.split('/')[1] || 'file';

  return `${sanitizePdfFilename(invoice.invoiceNumber)}-photo-id.${extension}`;
}

async function waitForInvoiceAssets(invoiceElement: HTMLElement) {
  await document.fonts?.ready;

  const images = Array.from(invoiceElement.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve();
            return;
          }

          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  );
}

function sanitizePdfFilename(filename: string) {
  const sanitizedFilename = filename
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  return sanitizedFilename || 'invoice';
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
    color: #565b63;
    font-family: Helvetica, Arial, sans-serif;
    background: transparent;
  }

  .invoice-page {
    position: relative;
    width: 794px;
    height: 1123px;
    margin: 0 0 18px;
    overflow: hidden;
    background: #ded9d9;
    border-top: 8px solid #8f8f8f;
    border-bottom: 8px solid #8f8f8f;
    page-break-after: always;
  }

  .invoice-page:last-child {
    margin-bottom: 0;
  }

  .invoice-watermark {
    position: absolute;
    inset: 0;
    z-index: 0;
    width: 100%;
    height: 100%;
    opacity: 0.045;
    object-fit: cover;
    object-position: center center;
    pointer-events: none;
    user-select: none;
  }

  .invoice-header {
    position: absolute;
    left: 26px;
    top: 18px;
    z-index: 2;
    display: grid;
    grid-template-columns: 430px 306px;
    width: 742px;
    min-height: 126px;
    align-items: start;
  }

  .invoice-logo-block {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .invoice-logo {
    width: 355px;
    height: auto;
    mix-blend-mode: multiply;
  }

  .invoice-logo-block p {
    margin: 2px 0 0;
    color: #5a6068;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: -0.045em;
    text-align: center;
  }

  .invoice-title-block {
    padding-top: 2px;
  }

  .invoice-title-block h1 {
    margin: 0 0 8px;
    color: #8997a1;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 25px;
    font-weight: 900;
    letter-spacing: -0.08em;
    line-height: 1.05;
    text-align: right;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .invoice-page--warranty .invoice-title-block h1 {
    width: 330px;
    margin-left: -68px;
    font-size: 22px;
  }

  .invoice-meta {
    display: grid;
    grid-template-columns: 146px 1fr;
    min-height: 74px;
    margin-left: auto;
    background: rgba(244, 243, 237, 0.62);
  }

  .invoice-meta strong,
  .invoice-meta span {
    padding: 2px 8px;
    color: #59616a;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 13px;
    font-weight: 800;
    line-height: 15px;
    white-space: nowrap;
  }

  .invoice-meta span {
    color: #28313b;
    font-weight: 500;
    line-height: 19px;
    overflow-wrap: anywhere;
  }

  .invoice-address-panel {
    position: absolute;
    left: 26px;
    top: 166px;
    z-index: 2;
    display: grid;
    grid-template-columns: 1fr 2px 1fr;
    width: 742px;
    min-height: 128px;
    border-top: 4px solid #929293;
  }

  .invoice-address-divider {
    margin: 16px 0 0;
    background: #969698;
  }

  .invoice-address-cell {
    display: grid;
    grid-template-rows: 1fr 38px;
    padding: 8px 8px 7px;
    gap: 8px;
    background: rgba(248, 248, 239, 0.58);
    color: #555b63;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 13px;
    font-weight: 700;
    line-height: 15px;
  }

  .invoice-address-cell--customer {
    grid-template-rows: auto 1fr 22px;
  }

  .invoice-address-cell p,
  .invoice-payment-summary p,
  .invoice-charge-summary p {
    margin: 0;
  }

  .invoice-address-cell strong,
  .invoice-payment-summary strong {
    color: #555b63;
    font-weight: 900;
    white-space: nowrap;
  }

  .invoice-address-cell span {
    margin-left: 8px;
    color: #303844;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 13px;
    font-weight: 500;
    line-height: 19px;
    overflow-wrap: anywhere;
  }

  .invoice-address-cell .invoice-shipping-address {
    display: inline-flex;
    flex-direction: column;
    gap: 1px;
    vertical-align: top;
  }

  .invoice-address-cell .invoice-shipping-address b {
    color: #1f2732;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 13px;
    font-weight: 900;
    line-height: 15px;
  }

  .invoice-address-cell .invoice-shipping-address span {
    margin-left: 0;
  }

  .invoice-delivery-note {
    position: absolute;
    left: 26px;
    top: 300px;
    z-index: 2;
    width: 742px;
    margin: 0;
    padding: 4px 0 12px;
    border-bottom: 4px solid #929293;
    color: #62656b;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.35;
    text-align: left;
  }

  .invoice-item-box,
  .invoice-payment-box {
    position: absolute;
    left: 26px;
    z-index: 2;
    width: 742px;
    border: 2px solid #111;
    border-radius: 8px;
    background: rgba(252, 252, 250, 0.72);
  }

  .invoice-item-box {
    top: 346px;
    height: 122px;
    padding: 10px 10px;
  }

  .invoice-table-head,
  .invoice-table-row {
    display: grid;
    grid-template-columns: 1fr 86px 154px;
    gap: 12px;
  }

  .invoice-table-head strong {
    color: #666b72;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 16px;
    font-weight: 900;
    letter-spacing: -0.06em;
    line-height: 18px;
  }

  .invoice-table-head strong:nth-child(2),
  .invoice-table-head strong:nth-child(3),
  .invoice-table-row span:nth-child(2),
  .invoice-table-row span:nth-child(3) {
    text-align: center;
  }

  .invoice-table-row {
    margin-top: 13px;
    color: #1f2732;
    font-size: 13px;
    font-weight: 500;
    line-height: 19px;
  }

  .invoice-table-row span:first-child {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .invoice-payment-box {
    top: 477px;
    height: 142px;
    display: grid;
    grid-template-columns: 1fr 276px;
    padding: 12px;
  }

  .invoice-payment-summary {
    color: #555b63;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 13px;
    font-weight: 700;
    line-height: 15px;
  }

  .invoice-payment-summary p {
    display: grid;
    grid-template-columns: 132px 1fr;
  }

  .invoice-payment-summary span {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 19px;
    font-weight: 500;
    color: #252b34;
    overflow-wrap: anywhere;
  }

  .invoice-charge-summary {
    color: #62676e;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 13px;
    font-weight: 500;
    line-height: 19px;
  }

  .invoice-charge-summary p {
    display: grid;
    grid-template-columns: 1fr 96px;
    gap: 14px;
  }

  .invoice-charge-summary span:last-child {
    color: #2f3540;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 19px;
  }

  .invoice-total-line {
    margin-top: 19px !important;
    align-items: center;
  }

  .invoice-total-line strong:first-child {
    color: #555960;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 17px;
    font-weight: 900;
  }

  .invoice-total-line strong:last-child {
    color: #2f3540;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 13px;
    font-weight: 900;
    line-height: 19px;
  }

  .invoice-additional-charges {
    position: absolute;
    left: 12px;
    bottom: 11px;
    color: #565a61;
    font-size: 8px;
    font-weight: 600;
    line-height: 1.3;
  }

  .invoice-additional-charges p {
    margin: 0 0 5px;
    color: #ff1f28;
    font-size: 9px;
    font-weight: 700;
    text-decoration: underline;
  }

  .invoice-additional-charges ul {
    margin: 0;
    padding-left: 15px;
  }

  .invoice-additional-charges strong {
    color: #ff1f28;
  }

  .invoice-signature-area,
  .invoice-signature-label,
  .invoice-signature-image,
  .invoice-signature-date-label,
  .invoice-signature-date {
    position: absolute;
    z-index: 3;
  }

  .invoice-signature-area {
    left: 572px;
    top: 1013px;
    width: 214px;
    height: 94px;
  }

  .invoice-signature-area::before,
  .invoice-signature-area::after {
    content: "";
    position: absolute;
    right: 0;
  }

  .invoice-signature-area::before {
    top: 0;
    width: 208px;
    height: 87px;
    border: 2px solid #111;
    background: rgba(255, 251, 217, 0.76);
  }

  .invoice-signature-area::after {
    top: 56px;
    width: 208px;
    height: 0;
    border-top: 2px solid #111;
  }

  .invoice-signature-label {
    display: none;
  }

  .invoice-signature-image {
    left: 8px;
    top: 5px;
    display: flex;
    width: 192px;
    height: 44px;
    align-items: center;
    justify-content: center;
    color: #111;
    font-family: "Brush Script MT", cursive;
    font-size: 24px;
    font-weight: 500;
    line-height: 1;
    text-align: center;
  }

  .invoice-signature-image img {
    max-width: 192px;
    max-height: 40px;
    object-fit: contain;
  }

  .invoice-signature-date-label {
    left: 10px;
    top: 64px;
    color: #111;
    font-size: 9px;
    font-weight: 800;
    line-height: 18px;
  }

  .invoice-signature-date {
    left: 44px;
    top: 61px;
    width: 154px;
    height: 24px;
    color: #111;
    font-size: 9px;
    font-weight: 500;
    line-height: 24px;
    text-align: center;
  }

  .invoice-warranty {
    position: absolute;
    left: 18px;
    top: 174px;
    z-index: 2;
    width: 748px;
    min-height: 432px;
    padding: 18px 16px;
    border: 3px solid rgba(151, 160, 169, 0.72);
    border-radius: 8px;
    background: rgba(232, 230, 230, 0.64);
    color: #5e646d;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10.2px;
    font-weight: 600;
    line-height: 1.2;
  }

  .invoice-warranty h2 {
    margin: 0 0 14px;
    color: #626770;
    font-size: 10.8px;
    font-weight: 900;
  }

  .invoice-warranty h3 {
    margin: 11px 0 3px;
    color: #626770;
    font-size: 10.5px;
    font-weight: 900;
  }

  .invoice-warranty ul {
    margin: 0;
    padding-left: 11px;
  }

  .invoice-warranty li {
    margin: 0;
  }

  .invoice-warranty p {
    display: none;
  }

  .invoice-acceptance-box {
    position: absolute;
    left: 26px;
    top: 692px;
    z-index: 2;
    width: 742px;
    min-height: 48px;
    padding: 11px 12px 8px;
    border: 2px solid #111;
    border-radius: 8px;
    background: rgba(252, 252, 252, 0.82);
    color: #101827;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.35;
  }

  .invoice-acceptance-box strong {
    display: block;
    margin-bottom: 4px;
    font-weight: 900;
  }

  .invoice-warranty-note {
    position: absolute;
    left: 26px;
    top: 784px;
    z-index: 2;
    width: 704px;
    margin: 0;
    color: #666973;
    font-size: 10.5px;
    font-weight: 700;
    line-height: 1.28;
  }

  .invoice-photo-id-pill {
    position: absolute;
    left: 16px;
    bottom: 24px;
    z-index: 4;
    border-radius: 4px;
    background: rgba(255, 250, 216, 0.96);
    padding: 4px 7px;
    color: #111;
    font-size: 10px;
    font-weight: 800;
  }

  .invoice-footer {
    position: absolute;
    left: 18px;
    bottom: 14px;
    z-index: 2;
    display: flex;
    gap: 10px;
    align-items: center;
    color: #62666f;
    font-size: 13.5px;
    font-weight: 500;
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
