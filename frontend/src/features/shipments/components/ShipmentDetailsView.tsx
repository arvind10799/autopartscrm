'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  History,
  LoaderCircle,
  MessageSquarePlus,
} from 'lucide-react';
import { DetailPageSkeleton } from '@/components/feedback/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { InvoiceActions } from '@/features/invoices/components/InvoiceActions';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { notesApi } from '@/features/notes/api/notes-api';
import type { NoteRecord } from '@/features/notes/types/note.types';
import { useOrderDetailWithRefresh } from '@/features/orders/hooks/useOrderDetail';
import { formatDateTime } from '@/features/orders/lib/order-formatters';
import type { OrderNote } from '@/features/orders/types/order.types';
import { useShipmentDetail } from '../hooks/useShipmentDetail';
import {
  formatShipmentStatusOptionLabel,
  getAllowedNextShipmentStatuses,
  getDefaultNextShipmentStatus,
} from '../lib/shipments.helpers';
import type { ShipmentDetail, ShipmentStatus } from '../types/shipment.types';
import { GrossProfitSummaryCard } from './GrossProfitSummaryCard';
import { ShipmentDetailGrid } from './ShipmentDetailGrid';
import { ShipmentStatusUpdateCard } from './ShipmentStatusUpdateCard';

export function ShipmentDetailsView({ shipmentId }: { shipmentId: string }) {
  const {
    shipment,
    isLoading,
    error,
    isUpdatingStatus,
    statusError,
    clearStatusError,
    refreshShipment,
    updateStatus,
  } = useShipmentDetail(shipmentId);
  const authUser = useAuthStore((state) => state.user);
  const [orderRefreshKey, setOrderRefreshKey] = useState(0);
  const {
    order: invoiceOrder,
    isLoading: isInvoiceOrderLoading,
    error: invoiceOrderError,
  } = useOrderDetailWithRefresh(shipment?.orderId ?? '', orderRefreshKey);
  const [selectedStatus, setSelectedStatus] = useState<ShipmentStatus | ''>('');
  const [proNumber, setProNumber] = useState('');

  useEffect(() => {
    if (!shipment) {
      setSelectedStatus('');
      setProNumber('');
      return;
    }

    setSelectedStatus(getDefaultNextShipmentStatus(shipment.currentStatus) ?? '');
    setProNumber('');
  }, [shipment]);

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !shipment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Shipment details</CardTitle>
          <CardDescription>
            The requested shipment could not be loaded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            {error ?? 'Shipment details are unavailable.'}
          </div>
          <Link
            href="/shipments"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to shipments
          </Link>
        </CardContent>
      </Card>
    );
  }

  const nextStatuses = getAllowedNextShipmentStatuses(shipment.currentStatus);
  const shipmentCost = shipment.costs[0] ?? null;
  const canAddAdditionalCost =
    authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';
  const canEditGpCosts =
    authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';

  const handleStatusSubmit = async () => {
    if (!selectedStatus) {
      return;
    }

    await updateStatus(selectedStatus, proNumber);
    setOrderRefreshKey((currentValue) => currentValue + 1);
  };

  const handleStatusChange = (status: ShipmentStatus) => {
    clearStatusError();
    setSelectedStatus(status);
    setProNumber('');
  };

  return (
    <section className="grid gap-6">
      {invoiceOrder ? (
        <InvoiceActions
          order={invoiceOrder}
          onInvoiceCreated={() =>
            setOrderRefreshKey((currentValue) => currentValue + 1)
          }
          backLink={{
            href: '/shipments',
            label: 'Back to shipments',
          }}
        />
      ) : (
        <Card>
          <CardHeader className="space-y-3">
            <Link
              href="/shipments"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit px-0')}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to shipments
            </Link>
            <CardTitle className="text-2xl">Invoice Management</CardTitle>
            <CardDescription>
              {isInvoiceOrderLoading
                ? 'Loading invoice management...'
                : invoiceOrderError ?? 'Invoice management is unavailable.'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-6">
          <GrossProfitSummaryCard
            shipmentId={shipment.id}
            totalSaleAmount={shipment.order.totalSaleAmount ?? 0}
            currency={shipment.order.currency}
            cost={shipmentCost}
            additionalCosts={shipment.additionalCosts}
            costHistories={shipment.costHistories}
            canAddAdditionalCost={canAddAdditionalCost}
            canEditBaseCost={canEditGpCosts}
            canEditAdditionalCosts={canEditGpCosts}
            onAdditionalCostAdded={async () => {
              await refreshShipment();
              setOrderRefreshKey((currentValue) => currentValue + 1);
            }}
            onCostUpdated={async () => {
              await refreshShipment();
              setOrderRefreshKey((currentValue) => currentValue + 1);
            }}
          />

          <ShipmentDetailGrid shipment={shipment} />

          <ShipmentNotesHistoryCard
            shipment={shipment}
            orderNotes={invoiceOrder?.notes ?? []}
            isOrderNotesLoading={isInvoiceOrderLoading}
          />
        </div>

        <div className="grid gap-6">
          <ShipmentStatusUpdateCard
            nextStatuses={nextStatuses}
            selectedStatus={selectedStatus}
            isUpdatingStatus={isUpdatingStatus}
            statusError={statusError}
            proNumber={proNumber}
            requiresProNumber={
              selectedStatus === 'IN_TRANSIT' && !shipment.proNumber
            }
            onStatusChange={handleStatusChange}
            onProNumberChange={(value) => {
              clearStatusError();
              setProNumber(value);
            }}
            onSubmit={handleStatusSubmit}
          />

          <ShipmentStatusHistoryCard
            shipment={shipment}
            notes={invoiceOrder?.notes ?? []}
            isLoading={isInvoiceOrderLoading}
          />
        </div>
      </div>
    </section>
  );
}

function ShipmentNotesHistoryCard({
  shipment,
  orderNotes,
  isOrderNotesLoading,
}: {
  shipment: ShipmentDetail;
  orderNotes: OrderNote[];
  isOrderNotesLoading: boolean;
}) {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const statusNotes = orderNotes.filter(isShipmentStatusHistoryNote);
  const timelineEntries = [
    ...notes.map((note) => ({
      id: note.id,
      timestamp: note.createdAt,
      authorName: note.author.name,
      label: 'Shipment note',
      badgeVariant: 'secondary' as const,
      body: note.message,
    })),
    ...statusNotes.map((note) => ({
      id: note.id,
      timestamp: note.createdAt,
      authorName: note.author.name,
      label: 'Edit history',
      badgeVariant: 'warning' as const,
      body: formatShipmentStatusHistoryBody(note.content),
    })),
  ].sort(
    (firstEntry, secondEntry) =>
      new Date(secondEntry.timestamp).getTime() -
      new Date(firstEntry.timestamp).getTime(),
  );

  useEffect(() => {
    let isMounted = true;

    const loadNotes = async () => {
      setIsLoadingNotes(true);
      setNotesError(null);

      try {
        const loadedNotes = await notesApi.listByEntity('SHIPMENT', shipment.id);

        if (isMounted) {
          setNotes(loadedNotes);
        }
      } catch (error) {
        if (isMounted) {
          setNotesError(
            error instanceof Error
              ? error.message
              : 'Unable to load shipment notes.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingNotes(false);
        }
      }
    };

    void loadNotes();

    return () => {
      isMounted = false;
    };
  }, [shipment.id]);

  const handleAddNoteSubmit = async () => {
    const trimmedMessage = noteMessage.trim();

    if (!trimmedMessage) {
      setNoteError('Note message is required.');
      return;
    }

    setIsSavingNote(true);
    setNoteError(null);

    try {
      const createdNote = await notesApi.create({
        entityType: 'SHIPMENT',
        entityId: shipment.id,
        message: trimmedMessage,
      });
      setNotes((currentNotes) => [createdNote, ...currentNotes]);
      setNoteMessage('');
      setIsAddNoteOpen(false);
    } catch (error) {
      setNoteError(
        error instanceof Error
          ? error.message
          : 'Unable to add this shipment note right now.',
      );
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <History className="h-5 w-5 text-primary" />
              Notes & Edit History
            </CardTitle>
            <CardDescription>
              Shipment notes and status history for this shipment workspace.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setIsAddNoteOpen((currentValue) => !currentValue);
              setNoteError(null);
            }}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Add Note
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAddNoteOpen ? (
          <form
            className="space-y-3 rounded-2xl border border-border/70 bg-secondary/20 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddNoteSubmit();
            }}
          >
            <label
              htmlFor="shipment-detail-note"
              className="text-sm font-semibold text-foreground"
            >
              New shipment note
            </label>
            <textarea
              id="shipment-detail-note"
              value={noteMessage}
              rows={4}
              onChange={(event) => setNoteMessage(event.target.value)}
              placeholder="Add a shipping update, carrier note, or handoff detail."
              className={cn(
                'w-full rounded-2xl border border-input bg-white/90 px-4 py-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                noteError ? 'border-destructive/60' : null,
              )}
            />
            {noteError ? (
              <p className="text-sm text-destructive">{noteError}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={isSavingNote}>
                {isSavingNote ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save note'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddNoteOpen(false);
                  setNoteError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {notesError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {notesError}
          </div>
        ) : null}

        {isLoadingNotes || isOrderNotesLoading ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
            Loading shipment notes and edit history...
          </div>
        ) : timelineEntries.length > 0 ? (
          <div className="space-y-3">
            {timelineEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-border/70 bg-secondary/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={entry.badgeVariant}>{entry.label}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {entry.authorName} | {formatDateTime(entry.timestamp)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {entry.body}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
            No shipment notes or edit history has been recorded yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShipmentStatusHistoryCard({
  shipment,
  notes,
  isLoading,
}: {
  shipment: ShipmentDetail;
  notes: OrderNote[];
  isLoading: boolean;
}) {
  const statusNotes = notes
    .filter(isShipmentStatusHistoryNote)
    .sort(
      (firstNote, secondNote) =>
        new Date(secondNote.createdAt).getTime() -
        new Date(firstNote.createdAt).getTime(),
    );
  const latestNote = statusNotes[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <History className="h-5 w-5 text-primary" />
          Last Status Update
        </CardTitle>
        <CardDescription>
          {latestNote
            ? `${latestNote.author.name} · ${formatDateTime(latestNote.createdAt)}`
            : isLoading
              ? 'Loading status history...'
              : `Current status: ${formatShipmentStatusOptionLabel(
                  shipment.currentStatus,
                )}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {statusNotes.length > 0 ? (
          <div className="space-y-3">
            {statusNotes.slice(0, 6).map((note) => (
              <div
                key={note.id}
                className="rounded-2xl border border-border/70 bg-secondary/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning">Shipment status</Badge>
                  <span className="text-xs text-muted-foreground">
                    {note.author.name} | {formatDateTime(note.createdAt)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                  {formatShipmentStatusHistoryBody(note.content)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
            No shipment status history has been recorded yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function isShipmentStatusHistoryNote(note: OrderNote): boolean {
  return note.content.startsWith('Shipment status updated:');
}

function formatShipmentStatusHistoryBody(content: string): string {
  return content.replace(/^Shipment status updated:\s*/i, '').trim();
}
