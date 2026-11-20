"use client";

import { type ReactNode, useId } from "react";

export interface Choice<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  tone?: "danger" | "warning" | "info";
}

/** One choice, with native radio navigation and a full-size pointer target. */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  optionContext,
}: {
  label: string;
  options: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  optionContext?: string;
}) {
  const name = useId();
  return (
    <div className="ui-choice-group" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className="ui-choice" data-tone={option.tone}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            aria-label={optionContext ? `${option.label}: ${optionContext}` : option.label}
            onChange={() => onChange(option.value)}
          />
          <span>
            {option.icon}
            <span>{option.label}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
