import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredArtifact<T = unknown> = {
  hash: string;
  path: string;
  value: T;
};

export type ArtifactReference = {
  kind: string;
  hash: string;
  role?: string;
};

export const ArtifactSchemaVersions = {
  "credential-schema": "pc-credential-schema-v1",
  "credential-issuer": "pc-credential-issuer-v1",
  "credential-issuer-suspension": "pc-credential-issuer-suspension-v1",
  "credential-revocation": "pc-credential-revocation-v1",
  "credential-revocation-root": "pc-credential-revocation-root-v1",
  "community-credential-trust-policy": "pc-community-credential-trust-policy-v1",
  "tally-committee-proposal": "pc-tally-committee-proposal-v1",
  "tally-committee-activation": "pc-tally-committee-activation-v1",
  "tally-committee-failure": "pc-tally-committee-failure-v1",
  "tally-key-setup": "pc-tally-key-setup-v1",
  "tally-decryption-share": "pc-tally-decryption-share-v1",
  "tally-publication-proof": "pc-tally-publication-proof-v1",
  "user-profile": "pc-user-profile-v1",
  "social-follow": "pc-social-follow-v1",
  "reputation-export": "pc-reputation-export-v1",
  "question-body": "pc-question-body-v1",
  "sponsor-disclosure": "pc-sponsor-disclosure-v1",
  "question-challenge-evidence": "pc-question-challenge-evidence-v1",
  "question-challenge-resolution": "pc-question-challenge-resolution-v1",
  "challenge-appeal": "pc-challenge-appeal-v1",
  "challenge-appeal-resolution": "pc-challenge-appeal-resolution-v1",
  "juror-selection": "pc-juror-selection-v1",
  "juror-conflict-disclosure": "pc-juror-conflict-disclosure-v1",
  "discussion-post": "pc-discussion-post-v1",
  "discussion-moderation": "pc-discussion-moderation-v1",
  "discussion-moderation-appeal": "pc-discussion-moderation-appeal-v1",
  "discussion-moderation-resolution": "pc-discussion-moderation-resolution-v1",
  "result-artifact": "pc-result-artifact-v1",
  "result-challenge-evidence": "pc-result-challenge-evidence-v1",
  "result-challenge-resolution": "pc-result-challenge-resolution-v1",
  "result-artifact-correction": "pc-result-artifact-correction-v1",
  "question-archive": "pc-question-archive-v1",
  "community-export": "pc-community-export-v1",
  "community-fork": "pc-community-fork-v1",
  "community-frontend-config": "pc-community-frontend-config-v1",
  "governance-parameter-proposal": "pc-governance-parameter-proposal-v1",
  "governance-parameter-activation": "pc-governance-parameter-activation-v1",
  "community-emergency-suspension": "pc-community-emergency-suspension-v1",
  "community-emergency-resolution": "pc-community-emergency-resolution-v1",
  "adoption-policy-proposal": "pc-adoption-policy-proposal-v1",
  "adoption-policy-activation": "pc-adoption-policy-activation-v1",
  "adoption-policy-suspension": "pc-adoption-policy-suspension-v1",
  "data-union-policy": "pc-data-union-policy-v1",
  "data-union-policy-activation": "pc-data-union-policy-activation-v1",
  "data-union-consent": "pc-data-union-consent-v1",
  "data-union-consent-revocation": "pc-data-union-consent-revocation-v1",
  "data-union-product": "pc-data-union-product-v1",
  "data-union-access-grant": "pc-data-union-access-grant-v1"
} as const;

export type ArtifactKind = keyof typeof ArtifactSchemaVersions;

export type ArtifactSchemaVersion<Kind extends ArtifactKind = ArtifactKind> = (typeof ArtifactSchemaVersions)[Kind];

export type VersionedArtifact<Kind extends ArtifactKind, T extends Record<string, unknown>> = T & {
  artifactKind: Kind;
  schemaVersion: ArtifactSchemaVersion<Kind>;
};

export type ArtifactManifest = {
  protocol: "popular-consensus";
  schemaVersion: "artifact-manifest-v1";
  references: ArtifactReference[];
};

export type StoredArtifactVerification<T = unknown> = {
  hash: string;
  path: string;
  computedHash: string | null;
  valid: boolean;
  value?: T;
  error?: string;
};

export type ArtifactReferenceVerification = ArtifactReference & StoredArtifactVerification;

export type ArtifactManifestVerification = {
  manifestHash: string;
  valid: boolean;
  references: ArtifactReferenceVerification[];
};

export type ArtifactExportBundleEntry = ArtifactReference & {
  computedHash: string;
  value: unknown;
};

export type ArtifactExportBundle = {
  protocol: "popular-consensus";
  schemaVersion: "artifact-export-bundle-v1";
  root?: ArtifactExportBundleEntry;
  manifest: ArtifactManifest;
  manifestHash: string;
  artifacts: ArtifactExportBundleEntry[];
};

export type ArtifactStorageAdapter = {
  write<T>(value: T): Promise<StoredArtifact<T>>;
  read<T = unknown>(hash: string): Promise<T>;
  verify<T = unknown>(hash: string): Promise<StoredArtifactVerification<T>>;
  buildExportBundle(manifest: ArtifactManifest, rootReference?: ArtifactReference): Promise<ArtifactExportBundle>;
};

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

export function hashJson(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function schemaVersionForArtifactKind<Kind extends ArtifactKind>(kind: Kind): ArtifactSchemaVersion<Kind> {
  return ArtifactSchemaVersions[kind];
}

export function withArtifactSchema<Kind extends ArtifactKind, T extends Record<string, unknown>>(kind: Kind, value: T): VersionedArtifact<Kind, T> {
  return {
    ...value,
    artifactKind: kind,
    schemaVersion: schemaVersionForArtifactKind(kind)
  };
}

export function createFileArtifactStorage(rootDir: string): ArtifactStorageAdapter {
  return {
    write: (value) => writeArtifact(rootDir, value),
    read: (hash) => readArtifact(rootDir, hash),
    verify: (hash) => verifyStoredArtifact(rootDir, hash),
    buildExportBundle: (manifest, rootReference) => buildArtifactExportBundle(rootDir, manifest, rootReference)
  };
}

export async function writeArtifact<T>(rootDir: string, value: T): Promise<StoredArtifact<T>> {
  const hash = hashJson(value);
  await mkdir(rootDir, { recursive: true });
  const artifactPath = artifactPathForHash(rootDir, hash);
  await writeFile(artifactPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return { hash, path: artifactPath, value };
}

export async function readArtifact<T = unknown>(rootDir: string, hash: string): Promise<T> {
  const raw = await readFile(artifactPathForHash(rootDir, hash), "utf8");
  return JSON.parse(raw) as T;
}

export async function verifyStoredArtifact<T = unknown>(rootDir: string, hash: string): Promise<StoredArtifactVerification<T>> {
  const artifactPath = artifactPathForHash(rootDir, hash);

  try {
    const raw = await readFile(artifactPath, "utf8");
    const value = JSON.parse(raw) as T;
    const computedHash = hashJson(value);

    return {
      hash,
      path: artifactPath,
      computedHash,
      valid: computedHash === hash,
      value
    };
  } catch (error) {
    return {
      hash,
      path: artifactPath,
      computedHash: null,
      valid: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function buildArtifactManifest(references: ArtifactReference[]): ArtifactManifest {
  return {
    protocol: "popular-consensus",
    schemaVersion: "artifact-manifest-v1",
    references: [...references].sort((left, right) => {
      const roleOrder = (left.role ?? "").localeCompare(right.role ?? "");
      if (roleOrder !== 0) return roleOrder;
      const kindOrder = left.kind.localeCompare(right.kind);
      if (kindOrder !== 0) return kindOrder;
      return left.hash.localeCompare(right.hash);
    })
  };
}

export function hashArtifactManifest(references: ArtifactReference[]): string {
  return hashJson(buildArtifactManifest(references));
}

export async function verifyArtifactManifest(rootDir: string, manifest: ArtifactManifest): Promise<ArtifactManifestVerification> {
  const references = await Promise.all(
    manifest.references.map(async (reference) => {
      const verification = await verifyStoredArtifact(rootDir, reference.hash);
      return { ...reference, ...verification };
    })
  );
  const manifestShapeValid = manifest.protocol === "popular-consensus" && manifest.schemaVersion === "artifact-manifest-v1";

  return {
    manifestHash: hashArtifactManifest(manifest.references),
    valid: manifestShapeValid && references.every((reference) => reference.valid),
    references
  };
}

export async function buildArtifactExportBundle(
  rootDir: string,
  manifest: ArtifactManifest,
  rootReference?: ArtifactReference
): Promise<ArtifactExportBundle> {
  const manifestVerification = await verifyArtifactManifest(rootDir, manifest);
  const rootVerification = rootReference ? await verifyStoredArtifact(rootDir, rootReference.hash) : null;
  const rootValid = rootVerification ? rootVerification.valid : true;

  if (!manifestVerification.valid || !rootValid) {
    throw new Error("Cannot build artifact export bundle with invalid artifact references");
  }

  return {
    protocol: "popular-consensus",
    schemaVersion: "artifact-export-bundle-v1",
    root: rootReference && rootVerification ? toExportBundleEntry(rootReference, rootVerification) : undefined,
    manifest: buildArtifactManifest(manifest.references),
    manifestHash: manifestVerification.manifestHash,
    artifacts: manifestVerification.references.map((reference) => toExportBundleEntry(reference, reference))
  };
}

function artifactPathForHash(rootDir: string, hash: string): string {
  return path.join(rootDir, `${hash.replace("sha256:", "")}.json`);
}

function toExportBundleEntry(reference: ArtifactReference, verification: StoredArtifactVerification): ArtifactExportBundleEntry {
  if (!verification.computedHash) {
    throw new Error(`Artifact ${reference.hash} was not verified`);
  }

  return {
    kind: reference.kind,
    hash: reference.hash,
    role: reference.role,
    computedHash: verification.computedHash,
    value: verification.value
  };
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortObject(entry)])
    );
  }

  return value;
}
