'use client';

import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function ErrorFallback({
  title,
  description,
  onReset,
  showReload = true,
}: {
  title: string;
  description: string;
  onReset: () => void;
  showReload?: boolean;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" onClick={onReset}>
            <RefreshCcw className="h-4 w-4" />
            Try again
          </Button>
          {showReload ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
