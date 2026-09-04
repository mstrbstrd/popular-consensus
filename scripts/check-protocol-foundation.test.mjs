import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cases = [
  ["valid catalog", null, true],
  ["missing invariant", (c) => c.invariants.pop(), false],
  ["duplicate invariant", (c) => c.invariants.push(c.invariants[0]), false],
  ["unsupported runtime claim", (c) => { c.invariants[0].runtimeEnforcement = "Enforced"; }, false],
  ["unsupported maturity claim", (c) => { c.status = "ProductionReady"; }, false],
  ["missing remaining work", (c) => { c.invariants[0].remainingWork = ""; }, false],
  ["outside-repository test path", (c) => { c.invariants[1].schemaTestFile = "../../outside.test.ts"; }, false],
  ["missing test file", (c) => { c.invariants[1].schemaTestFile = "missing.test.ts"; }, false]
];
for (const [name, mutate, expectedSuccess] of cases) {
  test(`foundation catalog: ${name}`, () => {
    const directory = mkdtempSync(resolve(tmpdir(), "popcon-foundation-"));
    try {
      for (const path of [
        "scripts/check-protocol-foundation.mjs",
        "docs/protocol-foundation/constitution.md",
        "docs/protocol-foundation/invariants.json",
        "packages/shared/src/foundation.test.ts"
      ]) {
        mkdirSync(dirname(resolve(directory, path)), { recursive: true });
        copyFileSync(resolve(root, path), resolve(directory, path));
      }
      const path = resolve(directory, "docs/protocol-foundation/invariants.json");
      const catalog = JSON.parse(readFileSync(path, "utf8"));
      if (mutate) mutate(catalog);
      writeFileSync(path, JSON.stringify(catalog));
      const result = spawnSync(process.execPath, [resolve(directory, "scripts/check-protocol-foundation.mjs")], {
        encoding: "utf8", timeout: 10000
      });
      assert.ifError(result.error);
      assert.equal(result.status === 0, expectedSuccess, result.stderr);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
