import * as React from "react";
import { cn } from "@/core/utils";

const textVariants = {
  display: "text-4xl sm:text-5xl font-black tracking-tighter text-(--color-foreground)",
  h1: "text-3xl sm:text-4xl font-extrabold tracking-tight text-(--color-foreground)",
  h2: "text-xl sm:text-2xl font-bold tracking-tight text-(--color-foreground)",
  h3: "text-lg font-bold text-(--color-foreground)",
  "body-large": "text-lg text-(--color-foreground)",
  body: "text-base text-(--color-foreground)",
  "body-small": "text-sm text-(--color-foreground)",
  caption: "text-xs text-(--color-muted-foreground)",
  muted: "text-sm text-(--color-muted-foreground)",
  "muted-lg": "text-lg text-(--color-muted-foreground)",
  label: "text-xs uppercase font-extrabold tracking-wider text-(--color-foreground)/80",
};

type TextVariant = keyof typeof textVariants;

interface TextProps extends React.HTMLAttributes<HTMLHeadingElement | HTMLParagraphElement | HTMLSpanElement> {
  as?: React.ElementType;
  variant?: TextVariant;
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ className, as, variant = "body", children, ...props }, ref) => {
    // Determine default element if 'as' is not provided
    const defaultElements: Record<TextVariant, React.ElementType> = {
      display: "h1",
      h1: "h1",
      h2: "h2",
      h3: "h3",
      "body-large": "p",
      body: "p",
      "body-small": "p",
      caption: "span",
      muted: "p",
      "muted-lg": "p",
      label: "label",
    };

    const Component = as || defaultElements[variant];

    return (
      <Component
        ref={ref}
        className={cn(textVariants[variant], className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Text.displayName = "Text";
