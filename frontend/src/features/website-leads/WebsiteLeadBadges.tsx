import { Badge } from '@/components/ui/badge';
import type { WebsiteLeadStatus } from './website-leads-api';

const STATUS_DISPLAY: Record<WebsiteLeadStatus, {
  label: string;
  variant: 'warning' | 'info' | 'neutral' | 'success';
}> = {
  NEW: { label: 'New', variant: 'warning' },
  CONTACTED: { label: 'Contacted', variant: 'info' },
  CLOSED: { label: 'Closed', variant: 'neutral' },
  CONVERTED: { label: 'Converted', variant: 'success' },
};

export function WebsiteLeadStatusBadge({ status }: { status: WebsiteLeadStatus }) {
  const display = STATUS_DISPLAY[status];
  return <Badge variant={display.variant}>{display.label}</Badge>;
}

export function WebsiteLeadAssignmentBadge({
  name,
  isMine,
}: {
  name: string | null;
  isMine?: boolean;
}) {
  return name ? (
    <Badge variant="neutral">{isMine ? 'Assigned to me' : name}</Badge>
  ) : (
    <Badge variant="outline" className="border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-300">
      Unassigned
    </Badge>
  );
}
