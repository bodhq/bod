import * as React from "react";

import { cn } from "@/core/utils";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: Callers pass htmlFor or render this inside the control's label.
    <label
      ref={ref}
      className={cn(
        "text-[13px] font-medium text-(--color-foreground) peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export { Label };
