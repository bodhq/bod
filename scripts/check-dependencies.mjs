import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const manifestUrl = new URL("../apps/web/package.json", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));
const requireFromWeb = createRequire(manifestUrl);
const pairs = [
  ["dependencies", "react", "react-dom"],
  ["devDependencies", "vitest", "@vitest/coverage-v8"],
];

for (const [group, left, right] of pairs) {
  const expected = manifest[group][left];
  if (!/^\d+\.\d+\.\d+$/.test(expected) || expected !== manifest[group][right]) {
    throw new Error(
      `${left} a ${right} musí mít stejnou přesně připnutou verzi v apps/web/package.json.`,
    );
  }
  for (const name of [left, right]) {
    const installed = requireFromWeb(`${name}/package.json`).version;
    if (installed !== expected) {
      throw new Error(
        `${name}: nainstalováno ${installed}, očekáváno ${expected}. Spusťte pnpm install --frozen-lockfile.`,
      );
    }
  }
}
console.log("Kompatibilita spojených verzí React a Vitest ověřena.");
