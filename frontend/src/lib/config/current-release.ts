import type { UserRole } from '@/features/auth/types/auth.types';

export const CURRENT_RELEASE = {
  id: '5.2',
  version: '5.2',
  title: 'What’s New in CRM 5.2',
  date: 'November 2026',
  description: 'Plan follow-ups, coordinate handoffs, and keep your next step clear.',
} as const;

export function hasReleaseHighlights(role: UserRole) {
  return role === 'ADMIN' || role === 'SALES' || role === 'SHIPPING';
}

export function getReleaseHighlights(role: UserRole) {
  if (!hasReleaseHighlights(role)) return [];

  return [
    {
      title: 'My Tasks and Calendar',
      description: role === 'SHIPPING'
        ? 'See your shared Shipping queue and personal tasks, review overdue checks, and plan work in Calendar.'
        : 'See overdue work, today’s follow-ups, and received assignments in My Tasks, then plan ahead in Calendar.',
    },
    {
      title: 'Reminders on your records',
      description: 'Set the next action and due time, snooze when needed, and complete work with an outcome and history.',
    },
    {
      title: 'Suggestions and repeating tasks',
      description: role === 'SHIPPING'
        ? 'Review suggested next steps after shipment changes and schedule regular yard or tracking checks until the work ends.'
        : 'Review suggested next steps after record changes, choose callback times, and schedule regular checks until the work ends.',
    },
    {
      title: 'Clear team handoffs',
      description: role === 'SHIPPING'
        ? 'Use Working on it to coordinate queue checks, send customer follow-ups to the order agent, and track sent handoffs.'
        : role === 'ADMIN'
          ? 'Oversee Sales and Shipping handoffs, shared queue work, and assignments needing attention.'
          : 'Send order-related work to Shipping and track its status while keeping your customer follow-up clear.',
    },
    {
      title: role === 'SHIPPING' ? 'Next checks at a glance' : 'Find the missing next step',
      description: role === 'SHIPPING'
        ? 'See the next check and overdue indicator in shipment tables and mobile cards.'
        : 'See Next follow-up in your tables, filter leads without an upcoming reminder, and include follow-up details in Lead and Order exports.',
    },
    ...(role === 'ADMIN' ? [{
      title: 'Follow-up reports and team settings',
      description: 'Review missing next steps, unsigned invoices, tracking checks and completion performance. Manage reminder types, suggestions and scheduling in User Center.',
    }] : []),
    {
      title: 'Your clock and alert preferences',
      description: 'Set your display time zone and working hours. Browser and email reminders are available after Admin activates delivery and the required setup is complete.',
    },
  ];
}
