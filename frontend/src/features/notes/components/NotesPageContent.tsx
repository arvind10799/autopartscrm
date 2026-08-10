'use client';

import { FileText, RefreshCw, Sparkles } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { WorkspacePageSkeleton } from '@/components/feedback/page-skeletons';
import { Badge } from '@/components/ui/badge';
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
import { AddNoteForm } from './AddNoteForm';
import { NotesList } from './NotesList';
import { useNotesWorkspace } from '../hooks/useNotesWorkspace';

export function NotesPageContent() {
  const [dateFilter, setDateFilter] = useState(
    createDefaultDateRangeFilterState(),
  );
  const [entitySearchTerm, setEntitySearchTerm] = useState('');
  const deferredEntitySearchTerm = useDeferredValue(entitySearchTerm);
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
    hasLoadedEntities,
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
  } = useNotesWorkspace(dateRangeQuery, deferredEntitySearchTerm);

  if (isEntitiesLoading && !hasLoadedEntities) {
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
      <Card className="overflow-hidden border-white/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(37,99,235,0.82))] text-white shadow-xl shadow-slate-950/10">
        <CardHeader className="space-y-5 p-6 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <Badge className="w-fit border-white/20 bg-white/15 text-white hover:bg-white/20">
                <Sparkles className="h-3.5 w-3.5" />
                Team activity hub
              </Badge>
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-3 text-3xl sm:text-4xl">
                  <FileText className="h-8 w-8 text-blue-100" />
                  Notes workspace
                </CardTitle>
                <CardDescription className="max-w-2xl text-sm leading-6 text-blue-50/85">
                  Search orders or PRO numbers, attach handoff notes, and keep every
                  customer update visible across sales, shipping, and admin workflows.
                </CardDescription>
              </div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-3 backdrop-blur [&_input]:!bg-white [&_input]:!text-slate-900 [&_input]:!placeholder-slate-400 [&_label]:!text-blue-50 [&_select]:!bg-white [&_select]:!text-slate-900">
              <DateRangeFilter
                value={dateFilter}
                onChange={setDateFilter}
                variant="inline"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <AddNoteForm
            form={form}
            availableEntityTypes={availableEntityTypes}
            selectedEntityType={selectedEntityType}
            selectedEntityId={selectedEntityId}
            selectableEntities={selectableEntities}
            entitySearchTerm={entitySearchTerm}
            isEntitiesLoading={isEntitiesLoading}
            formError={formError}
            onEntitySearchChange={setEntitySearchTerm}
            onEntityTypeChange={handleEntityTypeChange}
            onEntityIdChange={handleEntityIdChange}
            onSubmit={handleSubmit}
          />
        </aside>

        <NotesList
          notes={notes}
          isLoading={isNotesLoading}
          isRefreshing={isNotesRefreshing}
          error={notesError}
          onRetry={retryNotes}
          selectedEntityTitle={selectedEntityContext?.title ?? 'No record selected'}
          selectedEntitySubtitle={selectedEntityContext?.subtitle ?? 'Choose an order or shipment to view its notes.'}
        />
      </div>
    </section>
  );
}
