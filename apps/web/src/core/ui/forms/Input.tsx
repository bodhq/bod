"use client";

import type { InputHTMLAttributes } from "react";

import { forwardRef, useId } from "react";

import { Field, type FieldProps, fieldDescription } from "./Field";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
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
  const inputId = id ?? generatedId;
  return (
    <Field
      id={inputId}
      label={label}
      description={description}
      error={error}
      fieldWidth={fieldWidth}
      className={className}
    >
      <input
        {...props}
        ref={ref}
        id={inputId}
        className="ui-control"
        aria-invalid={invalid ?? Boolean(error)}
        aria-describedby={fieldDescription(inputId, description, error, describedBy)}
      />
    </Field>
  );
});
