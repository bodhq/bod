import type * as React from "react";

import { cn } from "@/core/utils";

export function Logo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="269"
      height="160"
      viewBox="0 0 269 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="bod logo"
      className={cn("text-(--color-foreground)", className)}
      {...props}
    >
      <title>bod logo</title>
      <use href="/brand/logo.svg#bod-logo" />
    </svg>
  );
}
