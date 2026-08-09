import * as React from "react";
import { cn } from "@/core/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: This is a reusable label component
    <label
      ref={ref}
      className={cn(
        "block text-xs uppercase font-extrabold tracking-wider text-(--color-foreground)/80 group-disabled:cursor-not-allowed group-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export { Label };
