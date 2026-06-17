'use client';

import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { WorkspacePageSkeleton } from '@/components/feedback/page-skeletons';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  buildTimestampRangeQuery,
  createDefaultDateRangeFilterState,
} from '@/lib/filters/date-range';
import { formatNoteEntityTypeLabel } from '../lib/notes.helpers';
import { AddNoteForm } from './AddNoteForm';
import { NotesList } from './NotesList';
import { useNotesWorkspace } from '../hooks/useNotesWorkspace';

export function NotesPageContent() {
  const [dateFilter, setDateFilter] = useState(
    createDefaultDateRangeFilterState(),
  );
  const dateRangeQuery = useMemo(
    () => buildTimestampRangeQuery(dateFilter),
    [dateFilter],
  );
  const {
    form,
    availableEntityTypes,
    selectedEntityType,
    selectedEntityId,
    selectableEntities,
    selectedEntityContext,
    notes,
    isEntitiesLoading,
    entitiesError,
    isNotesLoading,
    isNotesRefreshing,
    notesError,
    formError,
    retryEntities,
    retryNotes,
    handleEntityTypeChange,
    handleEntityIdChange,
    handleSubmit,
  } = useNotesWorkspace(dateRangeQuery);

  if (isEntitiesLoading) {
    return <WorkspacePageSkeleton />;
  }

  if (entitiesError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Notes workspace unavailable</CardTitle>
          <CardDescription>{entitiesError}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={retryEntities}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (availableEntityTypes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">No note entities available</CardTitle>
          <CardDescription>
            This role does not currently have any accessible entities to attach notes to.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="grid gap-6">
      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Entity type</CardDescription>
            <CardTitle className="text-2xl sm:text-[1.75rem]">
              {formatNoteEntityTypeLabel(selectedEntityType)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Switch between supported record types without leaving the workspace.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Selected entity</CardDescription>
            <CardTitle className="text-2xl sm:text-[1.75rem]">
              {selectedEntityContext?.title ?? '--'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {selectedEntityContext?.subtitle ?? 'Choose an entity to view and add notes.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Loaded notes</CardDescription>
            <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">
              {notes.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Refreshes after every successful save so the activity trail stays current.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-6">
          <AddNoteForm
            form={form}
            availableEntityTypes={availableEntityTypes}
            selectedEntityType={selectedEntityType}
            selectedEntityId={selectedEntityId}
            selectableEntities={selectableEntities}
            isEntitiesLoading={isEntitiesLoading}
            formError={formError}
            onEntityTypeChange={handleEntityTypeChange}
            onEntityIdChange={handleEntityIdChange}
            onSubmit={handleSubmit}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Entity context</CardTitle>
              <CardDescription>
                Keep selection details visible while writing follow-ups and handoffs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Focus record
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {selectedEntityContext?.title ?? 'No entity selected'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedEntityContext?.subtitle ??
                    'Select an order or shipment to activate the workspace.'}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Workspace behavior
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedEntityContext?.helperText ??
                    'Saved notes appear again after the list refresh completes.'}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Selection coverage
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectableEntities.length} accessible{' '}
                  {selectedEntityType === 'ORDER' ? 'orders' : 'shipments'} available
                  for note attachment.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <NotesList
          notes={notes}
          isLoading={isNotesLoading}
          isRefreshing={isNotesRefreshing}
          error={notesError}
          onRetry={retryNotes}
        />
      </div>
    </section>
  );
}
