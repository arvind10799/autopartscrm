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

  return (
    <Card className="rounded-2xl border-border/70 bg-background/80 shadow-none">
      <CardHeader className="space-y-4 p-5 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {formatNoteEntityTypeLabel(note.entityType)}
              </Badge>
              <Badge variant="secondary">{note.author.role}</Badge>
            </div>
            <CardTitle className="text-xl">{note.author.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{note.author.email}</p>
          </div>

          <div className="text-left text-sm text-muted-foreground sm:text-right">
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
