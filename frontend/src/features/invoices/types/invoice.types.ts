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
  quantity: number;
  saleAmount: number;
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
  signedAt: string | null;
  signatureIpAddress: string | null;
  signatureTokenExpiresAt: string | null;
  signatureRequestedAt: string | null;
  signatureLastSentAt: string | null;
  status: string;
  pdfStorageKey: string | null;
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
  | 'paymentStatus'
  | 'paymentDate'
  | 'paymentSource'
  | 'customerSignature'
  | 'customerSignatureImage'
  | 'signatureDate'
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
}

export interface PublicInvoiceRecord extends InvoiceRecord {
  canSign: boolean;
}

export interface SignInvoiceInput {
  customerSignature: string;
  customerSignatureImage: string;
}
