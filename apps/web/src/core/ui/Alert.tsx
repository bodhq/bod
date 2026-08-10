import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import * as React from "react";
import { cn } from "@/core/utils";

type AlertVariant = "default" | "destructive" | "success";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  icon?: boolean;
}

import { m } from "framer-motion";

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    { className, variant = "default", icon = true, children, ...props },
    ref,
  ) => {
    return (
      <m.div
        ref={ref as any}
        role="alert"
        aria-live="polite"
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className={cn(
          "flex items-center gap-3 rounded-2xl p-4 text-body-small font-medium border shadow-lg shadow-black/5 dark:shadow-black/20",
          {
            "bg-(--color-secondary) text-(--color-foreground) border-(--color-border)":
              variant === "default",
            "bg-(--color-destructive)/10 text-(--color-destructive) border-(--color-destructive)/20":
              variant === "destructive",
            "bg-(--color-action-base)/10 text-(--color-brand-text) border-(--color-action-base)/20":
              variant === "success",
          },
          className,
        )}
        {...(props as any)}
      >
        {icon && variant === "destructive" && (
          <AlertCircle className="h-5 w-5 shrink-0" />
        )}
        {icon && variant === "success" && (
          <CheckCircle2 className="h-5 w-5 shrink-0" />
        )}
        {icon && variant === "default" && (
          <Info className="h-5 w-5 shrink-0 text-(--color-muted-foreground)" />
        )}
        <div className="flex-1 leading-relaxed">{children}</div>
      </m.div>
    );
  },
);
Alert.displayName = "Alert";

export { Alert };
