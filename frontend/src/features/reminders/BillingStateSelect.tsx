"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { normalizeUsState, US_STATES } from "@/lib/forms/us-states";

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  id: string;
  value?: string;
  onChange: (value: string) => void;
};

export const BillingStateSelect = forwardRef<HTMLInputElement, Props>(
  ({ id, value = "", onChange, onBlur, disabled, ...props }, ref) => {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const input = useRef<HTMLInputElement | null>(null);
    const options = useRef<Array<HTMLButtonElement | null>>([]);
    const query = value.trim().toLowerCase();
    const displayValue =
      US_STATES.find(({ code }) => code === value)?.name ?? value;
    const matches = US_STATES.filter(
      ({ name, code }) =>
        name.toLowerCase().includes(query) ||
        code.toLowerCase().includes(query),
    ).map(({ code, name }) => ({ code, label: name }));
    const choices = query
      ? matches
      : [{ code: "", label: "Not set — Pacific fallback" }, ...matches];
    const choose = (code: string) => {
      onChange(code);
      setOpen(false);
      setActive(-1);
    };

    useEffect(() => {
      if (open && active >= 0)
        options.current[active]?.scrollIntoView({ block: "nearest" });
    }, [open, active]);

    return (
      <>
        <div className="relative">
          <Input
            {...props}
            ref={(node) => {
              input.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            id={id}
            role="combobox"
            aria-autocomplete="list"
            aria-describedby={
              [props["aria-describedby"], !query && `${id}-fallback`]
                .filter(Boolean)
                .join(" ") || undefined
            }
            aria-expanded={open}
            aria-controls={`${id}-options`}
            aria-activedescendant={
              open && active >= 0 ? `${id}-option-${active}` : undefined
            }
            autoComplete="off"
            placeholder="Search state name or abbreviation"
            className="h-11 rounded-xl pr-10"
            disabled={disabled}
            value={displayValue}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(event) => {
              onChange(event.target.value);
              setActive(-1);
              setOpen(true);
            }}
            onBlur={(event) => {
              const code = normalizeUsState(value);
              if (code) onChange(code);
              setOpen(false);
              setActive(-1);
              onBlur?.(event);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                setActive((index) => {
                  if (!choices.length) return -1;
                  if (index < 0 || !open)
                    return event.key === "ArrowDown" ? 0 : choices.length - 1;
                  return (
                    (index +
                      (event.key === "ArrowDown" ? 1 : choices.length - 1)) %
                    choices.length
                  );
                });
              } else if (
                event.key === "Enter" &&
                open &&
                active >= 0 &&
                choices[active]
              ) {
                event.preventDefault();
                choose(choices[active].code);
              } else if (event.key === "Escape" && open) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              }
            }}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label="Toggle billing state options"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted-foreground disabled:opacity-50"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const next = !open;
              input.current?.focus();
              setOpen(next);
              setActive(-1);
            }}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          {open && !disabled && (
            <div
              id={`${id}-options`}
              role="listbox"
              aria-label="Billing states"
              className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card py-1 text-sm shadow-xl"
            >
              {choices.map(({ code, label }, index) => (
                <button
                  key={code}
                  ref={(node) => {
                    options.current[index] = node;
                  }}
                  id={`${id}-option-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={code === (normalizeUsState(value) ?? "")}
                  className={`block w-full px-3 py-2 text-left text-foreground hover:bg-secondary ${active === index ? "bg-secondary" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(code)}
                >
                  {label}
                </button>
              ))}
              {!choices.length && (
                <p className="px-3 py-2 text-muted-foreground">
                  No matching states. Enter a full state name or two-letter
                  abbreviation.
                </p>
              )}
            </div>
          )}
        </div>
        {!query && (
          <p
            id={`${id}-fallback`}
            className="mt-1 text-xs text-muted-foreground"
          >
            Order reminders will use Pacific time until you select a billing
            state.
          </p>
        )}
      </>
    );
  },
);
BillingStateSelect.displayName = "BillingStateSelect";
