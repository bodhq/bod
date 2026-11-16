"use client";

import type { LucideIcon } from "lucide-react";

import { ResponsiveNavigation } from "./ResponsiveNavigation";

export interface ViewOption {
  id: string;
  title: string;
  icon?: LucideIcon;
}

export function ViewSwitcher({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: ViewOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ResponsiveNavigation
      label={label}
      value={value}
      options={items.map((item) => ({ value: item.id, label: item.title }))}
      onChange={onChange}
    >
      <nav aria-label={label} className="nav-list" data-orientation="horizontal">
        {items.map(({ id, title, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className="nav-link"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
          >
            {Icon && <Icon className="size-[18px] shrink-0" aria-hidden="true" />}
            <span className="nav-label">{title}</span>
          </button>
        ))}
      </nav>
    </ResponsiveNavigation>
  );
}
