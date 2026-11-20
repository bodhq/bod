"use client";

import type { ReactNode } from "react";

import { Select } from "@/core/ui/forms/Select";

/** Keep one selected agenda on a phone; retain the visible choices on desktop. */
export function ResponsiveNavigation({
  label,
  value,
  options,
  onChange,
  children,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="responsive-navigation">
      <div className="responsive-navigation-select">
        <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="responsive-navigation-links">{children}</div>
    </div>
  );
}
