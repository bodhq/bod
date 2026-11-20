"use client";

import { addDays, today } from "@/core/time/school";
import { Button } from "@/core/ui/actions/Button";
import { Input } from "@/core/ui/forms/Input";

export function DayNavigator({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (day: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="day-navigator" data-compact={compact}>
      <Button
        variant="outline"
        size="icon"
        aria-label="Předchozí den"
        onClick={() => onChange(addDays(value, -1))}
      >
        ←
      </Button>
      <Input
        className={compact ? "day-input" : "w-40 sm:w-48"}
        type="date"
        label={compact ? undefined : "Den výuky"}
        aria-label={compact ? "Den výuky" : undefined}
        fieldWidth="short"
        value={value}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
      />
      <Button
        variant="outline"
        size="icon"
        aria-label="Další den"
        onClick={() => onChange(addDays(value, 1))}
      >
        →
      </Button>
      <Button className="day-today" variant="outline" onClick={() => onChange(today())}>
        Dnes
      </Button>
    </div>
  );
}
