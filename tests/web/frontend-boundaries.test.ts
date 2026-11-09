import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, URL as NodeURL } from "node:url";

import { expect, it } from "vitest";

const source = fileURLToPath(new NodeURL("../../apps/web/src/", import.meta.url));
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? files(target) : /\.tsx?$/.test(entry.name) ? [target] : [];
  });
}
function imports(file: string): string[] {
  return [
    ...readFileSync(file, "utf8").matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g),
  ]
    .map((match) => match[1])
    .filter((specifier) => specifier?.startsWith("@/") || specifier?.startsWith("."))
    .map((specifier) =>
      specifier?.startsWith("@/")
        ? path.resolve(source, specifier.slice(2))
        : path.resolve(path.dirname(file), specifier ?? ""),
    );
}
it("keeps application infrastructure independent of feature modules", () => {
  const violations = files(path.join(source, "core")).flatMap((file) =>
    imports(file)
      .filter((target) => target.startsWith(path.join(source, "modules") + path.sep))
      .map((target) => `${path.relative(source, file)} → ${path.relative(source, target)}`),
  );
  expect(violations).toEqual([]);
});
it("keeps generic UI independent of auth, networking, preferences and application composition", () => {
  const ui = path.join(source, "core/ui") + path.sep;
  const core = path.join(source, "core") + path.sep;
  const violations = files(ui).flatMap((file) =>
    imports(file)
      .filter(
        (target) =>
          target.startsWith(core) &&
          !target.startsWith(ui) &&
          target !== path.join(source, "core/utils"),
      )
      .map((target) => `${path.relative(source, file)} → ${path.relative(source, target)}`),
  );
  expect(violations).toEqual([]);
});
