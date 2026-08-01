import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import * as React from "react";
import { cn } from "@/core/utils";

type AlertVariant = "default" | "destructive" | "success";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  icon?: boolean;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    { className, variant = "default", icon = true, children, ...props },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        className={cn(
          "flex items-center gap-3 rounded-xl p-4 text-sm font-medium border",
          {
            "bg-(--color-secondary) text-(--color-foreground) border-(--color-border)":
              variant === "default",
            "bg-(--color-destructive)/10 text-(--color-destructive) border-(--color-destructive)/20":
              variant === "destructive",
            "bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/20":
              variant === "success",
          },
          className,
        )}
        {...props}
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
      </div>
    );
  },
);
Alert.displayName = "Alert";

export { Alert };
