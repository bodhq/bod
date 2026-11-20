import "./quantity.css";

export function Quantity({
  value,
  label,
  limit = 48,
}: {
  value: number;
  label: string;
  limit?: number;
}) {
  const count = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  const visibleLimit = Math.max(0, Math.min(96, Math.floor(Number.isFinite(limit) ? limit : 48)));
  return (
    <div className="visual-quantity" role="img" aria-label={`${label}: ${count}`}>
      <div className="visual-dots" aria-hidden="true">
        {Array.from(
          { length: Math.min(count, visibleLimit) },
          (_, position) => `unit-${position + 1}`,
        ).map((id) => (
          <span key={id} />
        ))}
        {count > visibleLimit && <span className="visual-more">+{count - visibleLimit}</span>}
      </div>
      <p className="text-xs text-(--color-muted-foreground)">
        {label}: <strong className="text-(--color-foreground)">{count}</strong>
      </p>
    </div>
  );
}
export function Distribution({
  items,
  label,
}: {
  items: { id: string; label: string; value: number }[];
  label: string;
}) {
  const values = items.map((item) => ({
    ...item,
    value: Number.isFinite(item.value) ? Math.max(0, item.value) : 0,
  }));
  const max = Math.max(1, ...values.map((item) => item.value));
  return (
    <fieldset className="visual-distribution">
      <legend className="sr-only">{label}</legend>
      {values.map((item) => (
        <div key={item.id} className="visual-bar-row">
          <span>{item.label}</span>
          <div className="visual-bar-track" aria-hidden="true">
            <div style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <strong>{item.value}</strong>
        </div>
      ))}
    </fieldset>
  );
}
