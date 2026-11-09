"use client";

import type { TextareaHTMLAttributes } from "react";

import { forwardRef, useId } from "react";

import { Field, type FieldProps, fieldDescription } from "./Field";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
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
      <textarea
        {...props}
        ref={ref}
        id={fieldId}
        className="ui-control min-h-28 resize-y"
        aria-invalid={invalid ?? Boolean(error)}
        aria-describedby={fieldDescription(fieldId, description, error, describedBy)}
      />
    </Field>
  );
});
