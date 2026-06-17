import type { LucideIcon } from 'lucide-react';
import {
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  Phone,
  Settings,
  Truck,
} from 'lucide-react';
import type { UserRole } from '@/features/auth/types/auth.types';

export interface NavigationItemConfig {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: UserRole[];
  group: 'workspace' | 'administration';
  defaultFor?: UserRole[];
}

export const navigationConfig: NavigationItemConfig[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Shared operational overview for every role.',
    icon: Gauge,
    roles: ['ADMIN', 'SALES', 'SHIPPING'],
    group: 'workspace',
    defaultFor: ['ADMIN'],
  },
  {
    href: '/leads',
    label: 'Leads',
    description: 'Sales lead intake, follow-up tracking, and order conversion.',
    icon: Phone,
    roles: ['ADMIN', 'SALES'],
    group: 'workspace',
  },
  {
    href: '/orders',
    label: 'Orders',
    description: 'Sales-driven order pipelines, summaries, and customer actions.',
    icon: ClipboardList,
    roles: ['ADMIN', 'SALES'],
    group: 'workspace',
    defaultFor: ['SALES'],
  },
  {
    href: '/shipments',
    label: 'Shipments',
    description: 'Shipping operations, delivery status, and movement visibility.',
    icon: Truck,
    roles: ['ADMIN', 'SHIPPING'],
    group: 'workspace',
    defaultFor: ['SHIPPING'],
  },
  {
    href: '/shipments/create',
    label: 'Create shipment',
    description: 'Pick eligible confirmed orders and convert them into shipments.',
    icon: Truck,
    roles: ['SHIPPING'],
    group: 'workspace',
  },
  {
    href: '/costs',
    label: 'Costs',
    description: 'Margin, purchase, shipping, and review workflows.',
    icon: CreditCard,
    roles: ['ADMIN', 'SHIPPING'],
    group: 'workspace',
  },
  {
    href: '/notes',
    label: 'Notes',
    description: 'Cross-team notes and entity-level collaboration records.',
    icon: FileText,
    roles: ['ADMIN', 'SALES', 'SHIPPING'],
    group: 'workspace',
  },
  {
    href: '/settings',
    label: 'Settings',
    description: 'Administrative controls and platform preferences.',
    icon: Settings,
    roles: ['ADMIN'],
    group: 'administration',
  },
];

export function matchNavigationItem(pathname: string): NavigationItemConfig | null {
  const matches = navigationConfig.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.sort((left, right) => right.href.length - left.href.length)[0];
}
