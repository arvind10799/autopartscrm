import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function ModuleWorkspacePage({
  title,
  description,
  sideTitle,
  sideDescription,
  roleAccess,
  roleHint,
}: {
  title: string;
  description: string;
  sideTitle: string;
  sideDescription: string;
  roleAccess: string;
  roleHint: string;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.28fr_0.92fr]">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-6">
            <div className="space-y-2">
              <Badge>Layout reserve</Badge>
              <p className="font-[var(--font-heading)] text-2xl font-bold text-foreground">
                Ready for production module content
              </p>
              <p className="max-w-xl text-sm text-muted-foreground">
                This content region is intentionally chart-free and ready for filters, tables, forms, or detail panes in the next implementation pass.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{sideTitle}</CardTitle>
          <CardDescription>{sideDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Role access
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">{roleAccess}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Workspace note
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{roleHint}</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
