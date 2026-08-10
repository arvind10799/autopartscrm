import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  formatNoteEntityTypeLabel,
  formatNoteTimestamp,
  getNoteEntityReference,
} from '../lib/notes.helpers';
import type { NoteRecord } from '../types/note.types';

export function NoteCard({ note }: { note: NoteRecord }) {
  const entityReference = getNoteEntityReference(note);
  const authorInitial = note.author.name.trim().charAt(0).toUpperCase() || 'U';

  return (
    <Card className="rounded-3xl border-border/70 bg-white/95 shadow-sm shadow-slate-950/5">
      <CardHeader className="space-y-4 p-5 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
              {authorInitial}
            </div>
            <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {formatNoteEntityTypeLabel(note.entityType)}
              </Badge>
              <Badge variant="secondary">{note.author.role}</Badge>
            </div>
              <CardTitle className="truncate text-xl">{note.author.name}</CardTitle>
              <p className="break-all text-sm text-muted-foreground">{note.author.email}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-secondary/30 px-3 py-2 text-left text-xs text-muted-foreground sm:text-right">
            <p>{formatNoteTimestamp(note.createdAt)}</p>
            {note.updatedAt !== note.createdAt ? (
              <p>Updated {formatNoteTimestamp(note.updatedAt)}</p>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5 pt-0">
        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
          {note.message}
        </p>

        <div className="rounded-2xl border border-border/70 bg-secondary/30 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Linked entity
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {entityReference
              ? `${entityReference.title} | ${entityReference.description}`
              : 'Entity reference unavailable'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
