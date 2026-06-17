import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

interface WorkspacePanelProps {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function WorkspacePanel({
  title,
  description,
  children,
  className,
  contentClassName,
}: WorkspacePanelProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-2xl sm:text-[1.75rem]">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={cn('space-y-4', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
