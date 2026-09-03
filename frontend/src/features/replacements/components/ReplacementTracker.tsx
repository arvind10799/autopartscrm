'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { formatDateTime, formatRelativeTime } from '@/features/orders/lib/order-formatters';
import { toast } from '@/lib/stores/toast.store';
import { replacementsApi } from '../api/replacements-api';
import { useReplacementsList } from '../hooks/useReplacementsList';
import { formatReplacementStatus } from '../lib/replacements.helpers';
import type { ReplacementRequest, ReplacementStatus } from '../types/replacement.types';
import { ReplacementRequestModal } from './ReplacementRequestModal';
import { ReplacementStatusBadge } from './ReplacementStatusBadge';

type ReplacementTrackerProps = {
  orderId: string;
  shipmentId?: string;
  compact?: boolean;
};

export function ReplacementTracker({
  orderId,
  shipmentId,
  compact = false,
}: ReplacementTrackerProps) {
  const authUser = useAuthStore((state) => state.user);
  const canManage = authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';
  const [refreshKey, setRefreshKey] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReplacement, setEditingReplacement] =
    useState<ReplacementRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { replacementsResponse, isLoading } = useReplacementsList({
    page: 1,
    search: '',
    status: 'ALL',
    orderId,
    shipmentId,
    refreshKey,
  });
  const latestReplacement = replacementsResponse.items[0] ?? null;

  const openCreateModal = () => {
    setEditingReplacement(null);
    setSaveError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (replacement: ReplacementRequest) => {
    setEditingReplacement(replacement);
    setSaveError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (payload: {
    customerReason: string;
    yardUpdate?: string;
    replacementStatus: ReplacementStatus;
    replacementProNumber?: string;
    replacementCarrierName?: string;
  }) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      if (editingReplacement) {
        await replacementsApi.update(editingReplacement.id, payload);
        toast.success('Replacement updated', 'Replacement history was refreshed.');
      } else {
        await replacementsApi.create({
          ...payload,
          orderId,
          shipmentId,
        });
        toast.success('Replacement created', 'Replacement order is now tracked.');
      }

      setIsModalOpen(false);
      setEditingReplacement(null);
      setRefreshKey((currentValue) => currentValue + 1);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to save replacement right now.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className={compact ? 'space-y-2 pb-3' : 'space-y-3 pb-3'}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <RotateCcw className="h-5 w-5 text-primary" />
                Replacement
              </CardTitle>
              <CardDescription className="text-xs">
                Customer reason, yard updates, and replacement status tracking.
              </CardDescription>
            </div>
            {canManage ? (
              <Button size="sm" onClick={openCreateModal}>
                <RotateCcw className="h-4 w-4" />
                Replacement
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="rounded-2xl border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
              Loading replacement tracking...
            </div>
          ) : latestReplacement ? (
            <div className="rounded-2xl border border-border/70 bg-secondary/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <ReplacementStatusBadge status={latestReplacement.replacementStatus} />
                  <p className="text-sm font-semibold text-foreground">
                    {formatReplacementStatus(latestReplacement.replacementStatus)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDateTime(latestReplacement.updatedAt)} (
                    {formatRelativeTime(latestReplacement.updatedAt)})
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/replacement-orders/${latestReplacement.id}`}>
                    <Button variant="outline" size="sm">
                      Open
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  {canManage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(latestReplacement)}
                    >
                      Update
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <ReplacementLine label="Customer Reason" value={latestReplacement.customerReason} />
                <ReplacementLine
                  label="Yard Update"
                  value={latestReplacement.yardUpdate ?? 'No yard update yet'}
                />
              </div>
              {replacementsResponse.items.length > 1 ? (
                <Badge variant="neutral" className="mt-3">
                  {replacementsResponse.items.length - 1} older replacement request
                  {replacementsResponse.items.length - 1 === 1 ? '' : 's'}
                </Badge>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/10 p-4 text-sm text-muted-foreground">
              No replacement request has been created for this record yet.
            </div>
          )}
        </CardContent>
      </Card>

      {isModalOpen ? (
        <ReplacementRequestModal
          replacement={editingReplacement}
          isSaving={isSaving}
          error={saveError}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </>
  );
}

function ReplacementLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-foreground">
        {value}
      </p>
    </div>
  );
}
