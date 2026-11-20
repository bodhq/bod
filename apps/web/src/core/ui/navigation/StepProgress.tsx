"use client";

import { Check } from "lucide-react";

import { ResponsiveNavigation } from "./ResponsiveNavigation";

export function StepProgress({
  steps,
  current,
  completed,
  onChange,
  label = "Postup nastavení",
}: {
  steps: string[];
  current: number;
  /** Omit for a linear wizard; provide actual completion for freely navigable steps. */
  completed?: boolean[];
  onChange?: (index: number) => void;
  label?: string;
}) {
  const content = (
    <ol className="step-progress" aria-label={label}>
      {steps.map((title, index) => {
        const done = completed ? completed[index] === true : !onChange && index < current;
        const content = (
          <>
            <span className="step-progress-number" aria-hidden="true">
              {done ? <Check size={14} /> : index + 1}
            </span>
            <span>{title}</span>
          </>
        );
        return (
          <li
            key={title}
            aria-current={index === current ? "step" : undefined}
            data-complete={done}
          >
            {onChange ? (
              <button type="button" className="step-progress-link" onClick={() => onChange(index)}>
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
  return onChange ? (
    <ResponsiveNavigation
      label={label}
      value={String(current)}
      options={steps.map((title, index) => ({ value: String(index), label: title }))}
      onChange={(value) => onChange(Number(value))}
    >
      {content}
    </ResponsiveNavigation>
  ) : (
    content
  );
}
