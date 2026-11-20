"use client";

import type { Row } from "./types";

import { createContext, type ReactNode, useContext } from "react";

export interface RecordScope {
  defaults: Row;
  interval: { start: string; end: string; label: string };
  referenceFilters?: Record<string, Row>;
}
const ScopeContext = createContext<RecordScope | null>(null);
export function RecordScopeProvider({
  value,
  children,
}: {
  value: RecordScope | null;
  children: ReactNode;
}) {
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}
export function useRecordScope() {
  return useContext(ScopeContext);
}

const ReferenceScopeContext = createContext<Record<string, Row>>({});
export const ReferenceScopeProvider = ReferenceScopeContext.Provider;
export function useReferenceScope() {
  return useContext(ReferenceScopeContext);
}

/** Named choices from an already authorized response, e.g. the teacher's schedule. */
const ReferenceOptionsContext = createContext<Record<string, Record<string, string>>>({});
export const ReferenceOptionsProvider = ReferenceOptionsContext.Provider;
export function useReferenceOptions() {
  return useContext(ReferenceOptionsContext);
}
