"use client";

import { useSearchParams } from "next/navigation";

/** Screen navigation stays shareable and follows the browser's Back/Forward history. */
export function useQueryValue(key: string, fallback = "") {
  const params = useSearchParams();
  return [
    params.get(key) ?? fallback,
    (value: string, related: Record<string, string> = {}) => {
      const url = new URL(window.location.href);
      const previous = url.search;
      for (const [name, entry] of Object.entries({ ...related, [key]: value })) {
        if (entry) url.searchParams.set(name, entry);
        else url.searchParams.delete(name);
      }
      if (url.search === previous) return;
      window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
    },
  ] as const;
}
