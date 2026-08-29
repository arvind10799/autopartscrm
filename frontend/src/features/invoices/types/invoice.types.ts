export interface InvoiceAuditTimestamp {
  label: string;
  occurredAt: string;
}

export interface InvoiceAuditAttachmentDetails {
  documentTitle: string;
  fileName: string | null;
  mimeType: string | null;
  uploadedAt: string | null;
  hash: string;
}

export interface InvoiceAuditEvent {
  id: string;
  eventType: string;
  title: string;
  description: string;
  actorName: string | null;
  actorEmail: string | null;
  actorPhone: string | null;
  ipAddress: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface InvoiceAuditTrail {
  timestamps: InvoiceAuditTimestamp[];
  attachmentDetails: InvoiceAuditAttachmentDetails | null;
  events: InvoiceAuditEvent[];
}

export type InvoiceCurrency = 'USD' | 'CAD';

export interface InvoiceRecord {
  id: string;
  orderId: string;
  invoiceNumber: string;
  invoiceDate: string;
  salesAssistant: string | null;
  customerName: string;
  contactNumber: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  shippingVendor: string;
  deliveryTimeline: string;
  itemDescription: string;
  vehiclePartDescription: string | null;
  warrantyPartsOnly: string | null;
  cancellationPolicy: string | null;
  quantity: number;
  saleAmount: number;
  currency: InvoiceCurrency;
  paymentStatus: string | null;
  paymentDate: string | null;
  paymentSource: string | null;
  shippingCost: number;
  salesTaxes: number;
  coreCharge: number;
  totalAmount: number;
  customerSignature: string | null;
  customerSignatureImage: string | null;
  signatureDate: string | null;
  photoIdRequired: boolean;
  photoIdDocument: string | null;
  photoIdFileName: string | null;
  photoIdMimeType: string | null;
  photoIdUploadedAt: string | null;
  signedAt: string | null;
  signatureIpAddress: string | null;
  signatureTokenExpiresAt: string | null;
  signatureRequestedAt: string | null;
  signatureLastSentAt: string | null;
  status: string;
  pdfStorageKey: string | null;
  auditTrail?: InvoiceAuditTrail | null;
  hasAuditTrail?: boolean;
  hasPhotoIdDocument?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceDefaults = Omit<
  InvoiceRecord,
  | 'id'
  | 'orderId'
  | 'status'
  | 'pdfStorageKey'
  | 'createdAt'
  | 'updatedAt'
  | 'invoiceDate'
  | 'salesAssistant'
  | 'contactNumber'
  | 'billingAddress'
  | 'shippingAddress'
  | 'vehiclePartDescription'
  | 'cancellationPolicy'
  | 'paymentStatus'
  | 'paymentDate'
  | 'paymentSource'
  | 'customerSignature'
  | 'customerSignatureImage'
  | 'signatureDate'
  | 'photoIdDocument'
  | 'photoIdFileName'
  | 'photoIdMimeType'
  | 'photoIdUploadedAt'
  | 'signedAt'
  | 'signatureIpAddress'
  | 'signatureTokenExpiresAt'
  | 'signatureRequestedAt'
  | 'signatureLastSentAt'
> & {
  invoiceDate: string;
  salesAssistant: string;
  contactNumber: string;
  billingAddress: string;
  shippingAddress: string;
  vehiclePartDescription: string;
  warrantyPartsOnly: string;
  cancellationPolicy: string;
  paymentStatus: string;
  paymentDate: string;
  paymentSource: string;
  customerSignature: string;
  customerSignatureImage: string;
  signatureDate: string;
};

export interface CreateInvoiceInput {
  invoiceNumber: string;
  invoiceDate: string;
  salesAssistant?: string;
  customerName: string;
  contactNumber?: string;
  billingAddress?: string;
  shippingAddress?: string;
  shippingVendor: string;
  deliveryTimeline: string;
  itemDescription: string;
  vehiclePartDescription?: string;
  warrantyPartsOnly?: string;
  cancellationPolicy?: string;
  quantity: number;
  saleAmount: number;
  paymentStatus?: string;
  paymentDate?: string;
  paymentSource?: string;
  shippingCost: number;
  salesTaxes: number;
  coreCharge: number;
  customerSignature?: string;
  signatureDate?: string;
  photoIdRequired: boolean;
}

export interface PublicInvoiceRecord extends InvoiceRecord {
  canSign: boolean;
}

export type InvoiceSignatureSmsStatus = 'SENT' | 'SKIPPED' | 'FAILED';

export interface InvoiceSignatureRequestResult extends InvoiceRecord {
  signatureSmsStatus?: InvoiceSignatureSmsStatus;
  signatureSmsMessage?: string | null;
}

export interface SignInvoiceInput {
  customerSignature: string;
  customerSignatureImage: string;
  signedInvoicePdfBase64?: string;
  photoIdDocument?: string;
  photoIdFileName?: string;
  photoIdMimeType?: string;
}
