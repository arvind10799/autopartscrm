'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftRight } from 'lucide-react';

export function TableScrollArea({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () =>
      setScrollable(node.scrollWidth > node.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {scrollable && (
        <p className="crm-scroll-hint items-center gap-2 border-b border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
          Scroll horizontally to view all columns
        </p>
      )}
      <div
        ref={viewport}
        data-overflow={scrollable}
        className="crm-table-viewport min-w-0 max-w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        role="region"
        aria-label={`${label} table${scrollable ? ', scroll horizontally for more columns' : ''}`}
        tabIndex={scrollable ? 0 : undefined}
      >
        {children}
      </div>
    </>
  );
}
