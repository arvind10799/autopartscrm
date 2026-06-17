import { FileText } from 'lucide-react';

export default function NotesPage() {
  return (
    <section className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full border border-border/70 bg-secondary/50 p-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">
        Notes
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Cross-team notes and collaboration records will appear here once implemented.
      </p>
    </section>
  );
}
