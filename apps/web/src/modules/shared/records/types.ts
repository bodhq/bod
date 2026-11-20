export type Row = Record<string, unknown>;
export interface FieldDefinition {
  name: string;
  label: string;
  type: string;
  required: boolean;
  nullable: boolean;
  exclusiveEnd?: boolean;
  patchOnly?: boolean;
  defaultValue?: string | number | boolean;
  options?: string[];
  optionLabels?: Record<string, string>;
  reference?: string;
  maxLength?: number;
  min?: number;
  max?: number;
}
export interface ResourceDefinition {
  icon?: typeof List;
  id: string;
  module: string;
  title: string;
  createLabel?: string;
  canCreate?: boolean;
  description?: string;
  emptyTitle?: string;
  path: string;
  itemPath: string;
  permission: string;
  keys: string[];
  fields: FieldDefinition[];
  readFields: FieldDefinition[];
  patchFields: string[];
  parseCreate: (value: Row) => Row;
  parsePatch?: (value: Row) => Row;
  preparePatch?: (value: Row, previous: Row) => Row;
}
export interface WorkflowDefinition {
  id: string;
  title: string;
  path: string;
  method: "post" | "put";
  permission: string;
  description: string;
  fields: FieldDefinition[];
  parse: (value: Row) => Row;
}

import type { List } from "lucide-react";
