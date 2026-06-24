"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-(--color-surface) text-(--color-text-primary)">
      <div className="max-w-md rounded-lg border border-(--color-border) bg-(--color-surface-raised) p-8 text-center shadow-sm">
        <h2 className="mb-4 font-semibold text-xl">Něco se pokazilo</h2>
        <p className="mb-6 text-(--color-text-secondary)">
          Omlouváme se, ale při načítání této stránky došlo k chybě. Zkuste to
          prosím znovu.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-(--color-accent) px-4 py-2 font-medium text-white transition-colors hover:bg-(--color-accent-muted) hover:text-(--color-accent)"
        >
          Zkusit znovu
        </button>
      </div>
    </div>
  );
}
