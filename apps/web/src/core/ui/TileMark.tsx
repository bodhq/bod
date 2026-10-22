import { cn } from "@/core/utils";

export function TileMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none grid grid-cols-2 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-75 group-focus-visible:opacity-75 group-active:opacity-100",
        className,
      )}
    >
      <span className="h-1 w-1 scale-50 rounded-[1px] bg-current transition-transform duration-150 group-hover:scale-100 group-focus-visible:scale-100 group-active:scale-100" />
      <span className="h-1 w-1 scale-50 rounded-[1px] bg-current transition-transform delay-75 duration-150 group-hover:scale-100 group-focus-visible:scale-100 group-active:scale-100" />
      <span className="h-1 w-1 scale-50 rounded-[1px] bg-current transition-transform delay-100 duration-150 group-hover:scale-100 group-focus-visible:scale-100 group-active:scale-100" />
      <span className="h-1 w-1 scale-50 rounded-[1px] bg-current transition-transform delay-150 duration-150 group-hover:scale-100 group-focus-visible:scale-100 group-active:scale-100" />
    </span>
  );
}
