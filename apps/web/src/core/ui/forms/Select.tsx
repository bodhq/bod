"use client";

import type { SelectHTMLAttributes } from "react";

import { ChevronDown } from "lucide-react";
import { forwardRef, useId } from "react";

import { Field, type FieldProps, fieldDescription } from "./Field";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    id,
    label,
    description,
    error,
    fieldWidth,
    className,
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <Field
      id={fieldId}
      label={label}
      description={description}
      error={error}
      fieldWidth={fieldWidth}
      className={className}
    >
      <div className="relative">
        <select
          {...props}
          ref={ref}
          id={fieldId}
          className="ui-control pr-10"
          aria-invalid={invalid ?? Boolean(error)}
          aria-describedby={fieldDescription(fieldId, description, error, describedBy)}
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-(--color-muted-foreground)"
          aria-hidden="true"
        />
      </div>
    </Field>
  );
});
