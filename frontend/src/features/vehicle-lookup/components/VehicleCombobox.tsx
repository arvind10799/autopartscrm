'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { VehicleLookupOption } from '@/features/vehicle-lookup/types/vehicle-lookup.types';

export function VehicleCombobox({
  id,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: {
  id: string;
  value: string;
  options: VehicleLookupOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedValue) {
      return options;
    }

    const startsWithMatches = options.filter((option) =>
      option.name.toLowerCase().startsWith(normalizedValue),
    );
    const containsMatches = options.filter((option) => {
      const optionName = option.name.toLowerCase();

      return (
        !optionName.startsWith(normalizedValue) &&
        optionName.includes(normalizedValue)
      );
    });

    return [...startsWithMatches, ...containsMatches];
  }, [normalizedValue, options]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className="h-11 rounded-xl pr-10"
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
        />
        <button
          type="button"
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setIsOpen((currentValue) => !currentValue)}
          aria-label={`Toggle ${id} options`}
        >
          <span className="text-xs">▼</span>
        </button>
      </div>

      {isOpen && !disabled ? (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-white py-1 text-sm shadow-xl">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={`${option.id}-${option.name}`}
                type="button"
                className="block w-full px-3 py-2 text-left text-foreground transition hover:bg-secondary"
                onClick={() => {
                  onChange(option.name);
                  setIsOpen(false);
                }}
              >
                {option.name}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-muted-foreground">
              No matching options. Manual input is allowed.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
