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
  'CALL_BACK_LATER',
  'NOT_INTERESTED',
  'NEEDS_LOCALLY',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface LeadSummary {
  id: string;
  date: string;
  adviserName: string;
  cmpt: string;
  customerPhone: string;
  customerName: string;
  partDescription: string;
  quote: number | null;
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
  partDescription: string;
  quote?: number;
  comments?: string;
  prospects: string;
  status: LeadStatus;
}

export type UpdateLeadInput = CreateLeadInput;
