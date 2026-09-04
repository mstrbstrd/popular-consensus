import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Catalog integrity check only. It does not count assertions as runtime security
// evidence and intentionally cannot mark any deployment invariant enforced.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(resolve(root, "docs/protocol-foundation/invariants.json"), "utf8"));
const constitution = readFileSync(resolve(root, "docs/protocol-foundation/constitution.md"), "utf8");
assert.equal(catalog.schemaVersion, "foundation-invariant-catalog-v0.2-draft");
assert.equal(catalog.status, "DraftNotIntegrated");
assert.equal(catalog.scope, "TargetRequirementsNotRuntimeGuarantees");
assert.ok(Array.isArray(catalog.invariants) && catalog.invariants.length > 0);
const requiredIds = [
  "PUR-01", "AUT-01", "PRV-01", "PRV-02", "USE-01", "USE-02", "ECO-01", "ECO-02",
  "ECO-03", "REC-01", "TIM-01", "MTH-01", "CIV-01", "GOV-01", "EXT-01", "PUB-01"
];
const seen = new Set();
for (const invariant of catalog.invariants) {
  assert.match(invariant.id, /^[A-Z]{3}-[0-9]{2}$/);
  assert.ok(!seen.has(invariant.id), `Duplicate invariant ${invariant.id}`);
  seen.add(invariant.id);
  assert.ok(constitution.includes(`| ${invariant.id} |`), `Missing constitution rule ${invariant.id}`);
  assert.ok(typeof invariant.requirement === "string" && invariant.requirement.trim().length > 0);
  assert.ok(typeof invariant.remainingWork === "string" && invariant.remainingWork.trim().length > 0);
  assert.equal(invariant.runtimeEnforcement, "NotIntegrated", `Unsupported runtime claim for ${invariant.id}`);
  assert.ok(["SchemaOnly", "SpecificationOnly"].includes(invariant.coverage));
  if (invariant.coverage === "SchemaOnly") {
    assert.equal(typeof invariant.schemaTestFile, "string");
    const path = resolve(root, invariant.schemaTestFile);
    assert.ok(path.startsWith(root + sep), "Test reference must remain in this repository");
    assert.ok(existsSync(path), `Missing test reference for ${invariant.id}`);
  } else {
    assert.equal(invariant.schemaTestFile, null);
  }
}
assert.deepEqual([...seen].sort(), requiredIds.sort(), "An invariant was dropped or added without updating the baseline check");
console.log(`Foundation catalog: ${seen.size} requirements; runtime enforcement remains NotIntegrated.`);
