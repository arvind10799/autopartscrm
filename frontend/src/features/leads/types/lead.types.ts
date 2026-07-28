export interface LeadUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SALES' | 'SHIPPING';
}

export interface LeadConvertedOrder {
  id: string;
  orderNumber: string;
  status: string;
}

export const LEAD_STATUSES = [
  'PROSPECT',
  'QUOTED',
  'CALL_BACK_LATER',
  'SHOPPING_AROUND',
  'NOT_INTERESTED',
  'NEEDS_LOCALLY',
  'WE_DONT_SALE',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_QUOTE_CURRENCIES = ['USD', 'CAD'] as const;

export type LeadQuoteCurrency = (typeof LEAD_QUOTE_CURRENCIES)[number];

export interface LeadSummary {
  id: string;
  date: string;
  adviserName: string;
  cmpt: string;
  customerPhone: string;
  customerName: string;
  customerEmail: string | null;
  state: string | null;
  partDescription: string;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleVariant: string | null;
  quote: number | null;
  quoteCurrency: LeadQuoteCurrency;
  comments: string | null;
  prospects: string;
  status: LeadStatus;
  isConverted: boolean;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: LeadUser;
  convertedOrder: LeadConvertedOrder | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface LeadsListResponse {
  items: LeadSummary[];
  meta: PaginationMeta;
}

export interface LeadsListQuery {
  page: number;
  limit: number;
  search?: string;
  converted?: boolean;
  status?: LeadStatus;
  createdFrom?: string;
  createdTo?: string;
}

export interface CreateLeadInput {
  leadDate: string;
  cmpt: string;
  customerPhone: string;
  customerName: string;
  customerEmail?: string;
  state?: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleVariant?: string;
  quote?: number;
  quoteCurrency?: LeadQuoteCurrency;
  comments?: string;
  prospects?: string;
  status: LeadStatus;
}

export type UpdateLeadInput = CreateLeadInput;
