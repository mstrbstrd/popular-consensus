import { hashArtifactManifest, hashJson, type ArtifactExportBundle, type ArtifactReference } from "@pc/artifacts";
import type { ProductionSliceVerificationInput } from "@pc/protocol-slice";
import { isRecord, replayReport, shapeOf } from "./checks";
import { rebuildProductionSliceState } from "./rebuildState";
import type { ReplayCheck, ReplayReport } from "./types";

export function verifyReplayValue(value: unknown): ReplayReport {
  if (isProductionSliceLike(value)) return verifyProductionSliceValue(value);
  if (isArtifactExportBundle(value)) return verifyArtifactBundle(value);
  return replayReport("unsupported", [
    {
      id: "input-supported-shape",
      ok: false,
      expected: "production-slice input/export or artifact export bundle",
      actual: shapeOf(value)
    }
  ]);
}

export function verifyProductionSliceValue(value: unknown): ReplayReport {
  const { report: productionSlice } = rebuildProductionSliceState(value);
  return {
    protocol: "popular-consensus",
    schemaVersion: "pc-replay-report-v1",
    mode: "production-slice",
    status: productionSlice.status,
    generatedAt: Date.now(),
    checks: productionSlice.checks,
    hashes: {
      manifestHash: productionSlice.hashes.archiveManifestHash,
      rootHash: productionSlice.hashes.archiveHash,
      eventStreamHash: productionSlice.hashes.eventStreamHash,
      transactionStreamHash: productionSlice.hashes.transactionStreamHash
    },
    productionSlice
  };
}

export function verifyArtifactBundle(bundle: ArtifactExportBundle): ReplayReport {
  const checks: ReplayCheck[] = [];
  const add = (id: string, ok: boolean, expected?: unknown, actual?: unknown, detail?: string) => checks.push({ id, ok, expected, actual, detail });
  const entries = bundle.root ? [bundle.root, ...bundle.artifacts] : bundle.artifacts;
  const computedManifestHash = hashArtifactManifest(bundle.manifest.references);
  const references = bundle.manifest.references;

  add("bundle-schema", bundle.protocol === "popular-consensus" && bundle.schemaVersion === "artifact-export-bundle-v1", "artifact-export-bundle-v1", bundle.schemaVersion);
  add("manifest-hash", bundle.manifestHash === computedManifestHash, computedManifestHash, bundle.manifestHash);
  add("root-present", Boolean(bundle.root), true, Boolean(bundle.root), "artifact export must include the archive root");
  add(
    "root-hash",
    !bundle.root || (bundle.root.hash === bundle.root.computedHash && bundle.root.hash === hashJson(bundle.root.value)),
    bundle.root?.hash ?? null,
    bundle.root ? hashJson(bundle.root.value) : null
  );
  add(
    "artifact-hashes",
    bundle.artifacts.every((entry) => entry.hash === entry.computedHash && entry.hash === hashJson(entry.value)),
    true,
    bundle.artifacts.map((entry) => ({ kind: entry.kind, hash: entry.hash, computedHash: entry.computedHash, actual: hashJson(entry.value) }))
  );
  add(
    "manifest-references-present",
    references.every((reference) => entryMatchesReference(entries, reference)),
    true,
    references.map((reference) => ({ ...reference, present: entryMatchesReference(entries, reference) }))
  );

  return replayReport("artifact-bundle", checks, {
    manifestHash: bundle.manifestHash,
    rootHash: bundle.root?.hash ?? null
  });
}

export function isProductionSliceLike(value: unknown): value is ProductionSliceVerificationInput | { input: ProductionSliceVerificationInput } {
  if (!isRecord(value)) return false;
  if (value.schemaVersion === "production-slice-input-v1") return true;
  return value.schemaVersion === "production-slice-export-v1" && isRecord(value.input);
}

export function isArtifactExportBundle(value: unknown): value is ArtifactExportBundle {
  return isRecord(value) && value.protocol === "popular-consensus" && value.schemaVersion === "artifact-export-bundle-v1" && isRecord(value.manifest) && Array.isArray(value.artifacts);
}

function entryMatchesReference(entries: Array<{ kind: string; hash: string }>, reference: ArtifactReference) {
  return entries.some((entry) => entry.kind === reference.kind && entry.hash === reference.hash);
}
