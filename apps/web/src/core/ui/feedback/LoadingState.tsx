import { Loader2 } from "lucide-react";

export function LoadingState({ children = "Načítám…" }: { children?: string }) {
  return (
    <p className="ui-loading" role="status">
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      {children}
    </p>
  );
}
