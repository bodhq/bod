"use client";

/** Keep save feedback visible after transient notifications disappear. */
export function SaveStatus({
  dirty = false,
  pending = false,
  saved = false,
  error = false,
  idle = "Změny uložíte tlačítkem Uložit.",
}: {
  dirty?: boolean;
  pending?: boolean;
  saved?: boolean;
  error?: boolean;
  idle?: string;
}) {
  const state = pending ? "pending" : error ? "error" : dirty ? "dirty" : saved ? "saved" : "idle";
  const text = {
    pending: "Ukládám změny…",
    error: "Změny se nepodařilo uložit. Zkuste to znovu.",
    dirty: "Máte neuložené změny.",
    saved: "Změny jsou uložené.",
    idle,
  }[state];
  return (
    <p className="ui-save-status" role="status" aria-atomic="true" data-state={state}>
      {text}
    </p>
  );
}
