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
    <Card className="rounded-3xl border-border/60 bg-card/95 shadow-sm shadow-slate-950/5">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
            {authorInitial}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{note.author.name}</CardTitle>
                <p className="break-all text-xs text-muted-foreground">{note.author.email}</p>
              </div>
              <div className="text-left text-xs text-muted-foreground sm:text-right">
                <p>{formatNoteTimestamp(note.createdAt)}</p>
                {note.updatedAt !== note.createdAt ? (
                  <p>Updated {formatNoteTimestamp(note.updatedAt)}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {formatNoteEntityTypeLabel(note.entityType)}
              </Badge>
              <Badge variant="secondary">{note.author.role}</Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-1 pl-[4.25rem]">
        <p className="rounded-2xl rounded-tl-sm border border-border/60 bg-secondary/30 px-4 py-3 text-sm leading-6 text-foreground">
          {note.message}
        </p>

        <div className="rounded-2xl border border-border/60 bg-secondary/40 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Linked record
          </p>
          <p className="mt-1 text-xs font-medium text-foreground">
            {entityReference
              ? `${entityReference.title} | ${entityReference.description}`
              : 'Entity reference unavailable'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
