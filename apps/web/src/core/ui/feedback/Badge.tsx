import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/core/utils";

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentPropsWithoutRef<"span"> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return <span {...props} className={cn("ui-badge", className)} data-tone={tone} />;
}
