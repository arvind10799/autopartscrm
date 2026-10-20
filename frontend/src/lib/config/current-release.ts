import type { UserRole } from '@/features/auth/types/auth.types';

export const CURRENT_RELEASE = {
  id: '5.1',
  version: '5.1',
  title: 'What’s New in CRM 5.1',
  date: 'October 2026',
} as const;

export function hasReleaseHighlights(role: UserRole) {
  return role === 'ADMIN' || role === 'SALES';
}

export function getReleaseHighlights(role: UserRole) {
  if (!hasReleaseHighlights(role)) return [];

  return [
    {
      title: 'Website Leads are here',
      description: 'Quote and part requests from the website now appear in the Website Leads tab.',
    },
    {
      title: 'Clearer follow-up',
      description: 'Filter requests by status and received date, review customer and part details, and keep internal notes.',
    },
    {
      title: 'Move requests into sales',
      description: role === 'ADMIN'
        ? 'Assign requests to sales agents and convert them into CRM leads.'
        : 'Claim available requests and convert them into CRM leads.',
    },
  ];
}
