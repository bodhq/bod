import { Button } from "@/core/ui/actions/Button";

export function Pagination({
  offset,
  count,
  pageSize = 50,
  pending = false,
  onChange,
  label = "Stránkování",
}: {
  offset: number;
  count: number;
  pageSize?: number;
  pending?: boolean;
  onChange: (offset: number) => void;
  label?: string;
}) {
  if (offset === 0 && count < pageSize) return null;
  return (
    <nav aria-label={label} className="ui-pagination">
      <span>
        Stránka {Math.floor(offset / pageSize) + 1} · {count} záznamů
      </span>
      <div>
        <Button
          variant="outline"
          disabled={pending || offset === 0}
          onClick={() => onChange(Math.max(0, offset - pageSize))}
        >
          Předchozí
        </Button>
        <Button
          variant="outline"
          disabled={pending || count < pageSize}
          onClick={() => onChange(offset + pageSize)}
        >
          Další
        </Button>
      </div>
    </nav>
  );
}
