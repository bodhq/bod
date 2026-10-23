"use client";

import { ChevronDown, type LucideIcon, X } from "lucide-react";

import { cn } from "@/core/utils";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  icon?: LucideIcon;
  className?: string;
  allowClear?: boolean;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Vybrat...",
  icon: Icon,
  className,
  allowClear = true,
}: SelectProps) {
  return (
    <div className={cn("relative min-w-0", className)}>
      {Icon && (
        <Icon
          aria-hidden="true"
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-(--color-muted-foreground)"
        />
      )}
      <select
        aria-label={placeholder}
        value={value ?? ""}
        onChange={(event) => onChange(event.currentTarget.value || null)}
        className={cn(
          "h-11 w-full appearance-none rounded-[var(--radius)] border border-(--color-border) bg-(--color-surface-100) px-3 pr-10 text-sm font-medium text-(--color-foreground)",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-background)",
          Icon && "pl-10",
          allowClear && value && "pr-16",
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {allowClear && value ? (
        <>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Vymazat výběr"
            className="absolute right-8 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-(--color-muted-foreground) hover:bg-(--color-surface-200) hover:text-(--color-foreground) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring)"
          >
            <X aria-hidden="true" size={14} />
          </button>
          <ChevronDown
            aria-hidden="true"
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-(--color-muted-foreground)"
          />
        </>
      ) : (
        <ChevronDown
          aria-hidden="true"
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-(--color-muted-foreground)"
        />
      )}
    </div>
  );
}
