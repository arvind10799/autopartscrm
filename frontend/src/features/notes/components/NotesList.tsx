import { RefreshCw, StickyNote } from 'lucide-react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { NotesListSkeleton } from '@/components/feedback/page-skeletons';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { NoteRecord } from '../types/note.types';
import { NoteCard } from './NoteCard';

type NotesListProps = {
  notes: NoteRecord[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  onRetry: () => void;
};

export function NotesList({
  notes,
  isLoading,
  isRefreshing,
  error,
  onRetry,
}: NotesListProps) {
  const hasNotes = notes.length > 0;

  if (isLoading) {
    return <NotesListSkeleton />;
  }

  if (error && !hasNotes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Notes unavailable</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!hasNotes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl sm:text-[1.75rem]">No notes yet</CardTitle>
          <CardDescription>
            Add the first note to start a shared activity trail for this entity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<StickyNote className="h-5 w-5" />}
            title="No timeline notes yet"
            description="New collaboration notes, handoffs, and customer updates will appear here as soon as the first note is saved."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-2xl sm:text-[1.75rem]">Notes list</CardTitle>
            <CardDescription>
              Most recent notes appear first so the latest collaboration stays visible.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isRefreshing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Refreshing notes...
              </>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : null}

        {notes.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </CardContent>
    </Card>
  );
}
