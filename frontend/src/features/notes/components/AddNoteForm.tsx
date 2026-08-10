'use client';

import { ArrowRight, LoaderCircle, Search } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';
import {
  formatNoteEntityTypeLabel,
  isNoteEntityType,
} from '../lib/notes.helpers';
import type { NoteFormValues } from '../schemas/note.schema';
import type { NoteEntityOption, NoteEntityType } from '../types/note.types';

type AddNoteFormProps = {
  form: UseFormReturn<NoteFormValues>;
  availableEntityTypes: NoteEntityType[];
  selectedEntityType: NoteEntityType;
  selectedEntityId: string;
  selectableEntities: NoteEntityOption[];
  entitySearchTerm: string;
  isEntitiesLoading: boolean;
  formError: string | null;
  onEntitySearchChange: (value: string) => void;
  onEntityTypeChange: (entityType: NoteEntityType) => void;
  onEntityIdChange: (entityId: string) => void;
  onSubmit: ReturnType<UseFormReturn<NoteFormValues>['handleSubmit']>;
};

export function AddNoteForm({
  form,
  availableEntityTypes,
  selectedEntityType,
  selectedEntityId,
  selectableEntities,
  entitySearchTerm,
  isEntitiesLoading,
  formError,
  onEntitySearchChange,
  onEntityTypeChange,
  onEntityIdChange,
  onSubmit,
}: AddNoteFormProps) {
  return (
    <Card className="overflow-hidden border-border/70 bg-white/90 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(37,99,235,0.09),rgba(255,255,255,0.96))] p-5">
        <CardDescription>Record selector</CardDescription>
        <CardTitle className="text-2xl sm:text-[1.75rem]">Add note</CardTitle>
        <CardDescription>
          Save a note against an order or shipment and refresh the activity feed in real time.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5">
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="entitySearch">Search order / PRO number</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="entitySearch"
                value={entitySearchTerm}
                onChange={(event) => onEntitySearchChange(event.target.value)}
                className="h-11 rounded-xl pl-9"
                placeholder="Search by order number or PRO number"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Results update the record dropdown using your selected entity type.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entityType">Entity type</Label>
              <Select
                id="entityType"
                value={selectedEntityType}
                disabled={isEntitiesLoading || availableEntityTypes.length === 0}
                onChange={(event) => {
                  const nextEntityType = event.target.value;

                  if (!isNoteEntityType(nextEntityType)) {
                    return;
                  }

                  onEntityTypeChange(nextEntityType);
                }}
              >
                {availableEntityTypes.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {formatNoteEntityTypeLabel(entityType)}
                  </option>
                ))}
              </Select>
              {form.formState.errors.entityType ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.entityType.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="entityId">
                {selectedEntityType === 'ORDER' ? 'Order' : 'Shipment'}
              </Label>
              <Select
                id="entityId"
                value={selectedEntityId}
                disabled={isEntitiesLoading || selectableEntities.length === 0}
                onChange={(event) => onEntityIdChange(event.target.value)}
              >
                {selectableEntities.length === 0 ? (
                  <option value="">
                    {isEntitiesLoading ? 'Loading entities...' : 'No entities available'}
                  </option>
                ) : (
                  selectableEntities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.label} — {entity.description}
                    </option>
                  ))
                )}
              </Select>
              {form.formState.errors.entityId ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.entityId.message}
                </p>
              ) : null}
              {selectedEntityId ? (
                <p className="text-sm text-muted-foreground">
                  {selectableEntities.find((entity) => entity.id === selectedEntityId)
                    ?.description ?? 'Entity context unavailable.'}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              rows={6}
              placeholder="Add a meaningful update, handoff, or follow-up note."
              className={cn(
                'flex min-h-[132px] w-full rounded-2xl border border-input bg-white/90 px-4 py-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                form.formState.errors.message ? 'border-destructive/60' : null,
              )}
              {...form.register('message')}
            />
            {form.formState.errors.message ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.message.message}
              </p>
            ) : null}
          </div>

          {formError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={
              isEntitiesLoading ||
              selectableEntities.length === 0 ||
              form.formState.isSubmitting
            }
          >
            {form.formState.isSubmitting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving note...
              </>
            ) : (
              <>
                Add note
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
