"use client";

import type { ResourceDefinition, WorkflowDefinition } from "./types";

import { createContext, type ReactNode, useContext } from "react";

interface RecordCatalog {
  resources: ResourceDefinition[];
  workflows: WorkflowDefinition[];
}
const CatalogContext = createContext<RecordCatalog | null>(null);

export function RecordCatalogProvider({
  catalog,
  children,
}: {
  catalog: RecordCatalog;
  children: ReactNode;
}) {
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}
export function useRecordCatalog() {
  const catalog = useContext(CatalogContext);
  if (!catalog) throw new Error("Chybí registrace modulů aplikace.");
  return {
    ...catalog,
    getWorkflow: (id: string) => {
      const workflow = catalog.workflows.find((item) => item.id === id);
      if (!workflow) throw new Error(`Neznámá operace: ${id}`);
      return workflow;
    },
    getResource: (id: string) => {
      const resource = catalog.resources.find((item) => item.id === id);
      if (!resource) throw new Error(`Neznámá evidence: ${id}`);
      return resource;
    },
  };
}
