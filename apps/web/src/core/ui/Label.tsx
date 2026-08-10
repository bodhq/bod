import * as React from "react";
import { cn } from "@/core/utils";

import { Text } from "@/core/ui/Text";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: This is a reusable label component
    <Text
      variant="label"
      as="label"
      ref={ref}
      className={cn(
        "block group-disabled:cursor-not-allowed group-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export { Label };
