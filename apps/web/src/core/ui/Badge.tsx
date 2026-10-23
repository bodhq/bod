import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/core/utils";

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "destructive" | "info";
  icon?: ReactNode;
}

export function Badge({ children, variant = "default", icon, className, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold cursor-default",
        "border",
        {
          "bg-(--color-surface-200) border-(--color-border) text-(--color-foreground)":
            variant === "default",
          "bg-(--color-success)/10 border-(--color-success)/30 text-(--color-success)":
            variant === "success",
          "bg-(--color-warning)/10 border-(--color-warning)/30 text-(--color-warning)":
            variant === "warning",
          "bg-(--color-destructive)/10 border-(--color-destructive)/30 text-(--color-destructive)":
            variant === "destructive",
          "bg-(--color-info)/10 border-(--color-info)/30 text-(--color-info)": variant === "info",
        },
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </div>
  );
}
