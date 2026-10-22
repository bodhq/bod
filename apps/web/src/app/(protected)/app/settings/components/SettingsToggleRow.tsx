import type { ReactNode } from "react";

import { Label } from "@/core/ui/Label";
import { Switch } from "@/core/ui/Switch";
import { cn } from "@/core/utils";

export function SettingsToggleRow({
  id,
  icon,
  label,
  description,
  checked,
  onChange,
  className,
}: {
  id: string;
  icon?: ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:gap-4", className)}>
      <div className="min-w-0">
        <Label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          {icon && <span className="text-(--color-muted-foreground) [&_svg]:size-4">{icon}</span>}
          {label}
        </Label>
        <p className="mt-1 text-sm leading-5 text-(--color-muted-foreground)">{description}</p>
      </div>
      <Switch id={id} checked={checked} onChange={onChange} />
    </div>
  );
}
