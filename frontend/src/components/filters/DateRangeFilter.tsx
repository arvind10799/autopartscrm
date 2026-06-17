'use client';

import { CalendarRange } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type {
  DateRangeFilterState,
  DateRangePreset,
} from '@/lib/filters/date-range';

const PRESET_OPTIONS: Array<{
  value: DateRangePreset;
  label: string;
}> = [
  { value: 'ALL', label: 'All time' },
  { value: 'LAST_7_DAYS', label: 'Last week' },
  { value: 'LAST_30_DAYS', label: 'Last month' },
  { value: 'CUSTOM', label: 'Custom range' },
];

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRangeFilterState;
  onChange: (value: DateRangeFilterState) => void;
}) {
  const isCustom = value.preset === 'CUSTOM';

  return (
    <div className="rounded-[1.35rem] border border-border/70 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <CalendarRange className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Created date</p>
            <p className="text-sm text-muted-foreground">
              Filter records by a preset window or a custom date range.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:min-w-[44rem]">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Range
            </label>
            <Select
              className="h-11 rounded-xl"
              aria-label="Created date preset"
              value={value.preset}
              onChange={(event) =>
                onChange({
                  ...value,
                  preset: event.target.value as DateRangePreset,
                })
              }
            >
              {PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              From
            </label>
            <Input
              className="h-11 rounded-xl"
              aria-label="Created from"
              type="date"
              value={value.from}
              onChange={(event) =>
                onChange({
                  ...value,
                  preset: 'CUSTOM',
                  from: event.target.value,
                })
              }
              disabled={!isCustom}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              To
            </label>
            <Input
              className="h-11 rounded-xl"
              aria-label="Created to"
              type="date"
              value={value.to}
              onChange={(event) =>
                onChange({
                  ...value,
                  preset: 'CUSTOM',
                  to: event.target.value,
                })
              }
              disabled={!isCustom}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
