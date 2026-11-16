"use client";

import type { InputHTMLAttributes } from "react";

import { forwardRef, useId, useRef } from "react";

import { Field, type FieldProps, fieldDescription } from "./Field";

type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max"> &
  FieldProps & { value: number; min: number; max: number; coarseStep?: number };

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  {
    id,
    label,
    description,
    error,
    fieldWidth,
    className,
    min,
    max,
    value,
    coarseStep,
    onChange,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onKeyDown,
    "aria-describedby": describedBy,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const motion = useRef<{
    pointer: number;
    x: number;
    at: number;
    coarse: boolean;
    fine: boolean;
  } | null>(null);
  return (
    <Field
      id={inputId}
      label={label}
      description={description}
      error={error}
      fieldWidth={fieldWidth}
      className={className}
    >
      <div className="ui-slider-row">
        <input
          {...props}
          ref={ref}
          id={inputId}
          type="range"
          className="ui-slider"
          min={min}
          max={max}
          value={value}
          onPointerDown={(event) => {
            motion.current = {
              pointer: event.pointerId,
              x: event.clientX,
              at: event.timeStamp,
              coarse: false,
              fine: event.shiftKey,
            };
            onPointerDown?.(event);
          }}
          onPointerMove={(event) => {
            const last = motion.current;
            if (last?.pointer === event.pointerId) {
              last.fine = event.shiftKey;
              const elapsed = event.timeStamp - last.at;
              // Sample over a frame so high-frequency pointer events do not make precision flicker.
              if (elapsed >= 16) {
                last.coarse = Math.abs(event.clientX - last.x) / elapsed > 0.5;
                last.x = event.clientX;
                last.at = event.timeStamp;
              }
            }
            onPointerMove?.(event);
          }}
          onPointerUp={(event) => {
            motion.current = null;
            onPointerUp?.(event);
          }}
          onPointerCancel={(event) => {
            motion.current = null;
            onPointerCancel?.(event);
          }}
          onLostPointerCapture={(event) => {
            motion.current = null;
            onLostPointerCapture?.(event);
          }}
          onKeyDown={(event) => {
            motion.current = null;
            onKeyDown?.(event);
          }}
          onChange={(event) => {
            if (coarseStep && motion.current?.coarse && !motion.current.fine) {
              const snapped =
                min +
                Math.round((event.currentTarget.valueAsNumber - min) / coarseStep) * coarseStep;
              event.currentTarget.value = String(Math.max(min, Math.min(max, snapped)));
            }
            onChange?.(event);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={fieldDescription(inputId, description, error, describedBy)}
        />
        <output htmlFor={inputId}>{value.toLocaleString("cs-CZ")}</output>
      </div>
      <div className="ui-slider-scale" aria-hidden="true">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </Field>
  );
});
