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
  selectedEntityTitle: string;
  selectedEntitySubtitle: string;
};

export function NotesList({
  notes,
  isLoading,
  isRefreshing,
  error,
  onRetry,
  selectedEntityTitle,
  selectedEntitySubtitle,
}: NotesListProps) {
  const hasNotes = notes.length > 0;

  if (isLoading) {
    return <NotesListSkeleton />;
  }

  if (error && !hasNotes) {
    return (
      <Card className="border-border/70 bg-card/90 shadow-sm">
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
      <Card className="overflow-hidden border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardDescription>{selectedEntitySubtitle}</CardDescription>
          <CardTitle className="text-2xl sm:text-[1.75rem]">{selectedEntityTitle}</CardTitle>
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
    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.05),rgba(255,255,255,0.98))] px-5 py-4 dark:bg-[linear-gradient(135deg,rgba(96,165,250,0.08),rgba(15,23,42,0.96))]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardDescription>{selectedEntitySubtitle}</CardDescription>
            <CardTitle className="text-2xl sm:text-[1.75rem]">
              {selectedEntityTitle}
            </CardTitle>
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
      <CardContent className="space-y-3 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.06),transparent_35%),linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96))] p-4 dark:bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.1),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))] sm:p-5">
        {error ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : null}

        <div className="space-y-3">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
        </div>
      </CardContent>
    </Card>
  );
}
