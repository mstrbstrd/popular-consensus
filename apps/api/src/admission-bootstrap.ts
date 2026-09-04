import { createHash, createPublicKey } from "node:crypto";
import { open } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createAdmissionClient, AdmissionPrisma, type AdmissionClient } from "../../../packages/db/src/admission";
import { AdmissionBootstrapSchema } from "../../../packages/shared/src/admission";
import { readRuntimeConfig } from "./runtime-policy";

/** Trusted local provisioning, not protocol enrollment. All authority comes
 * from the operator's explicit bootstrap file. No account IDs or roles from the
 * old demo are promoted. Calling twice fails instead of replacing keys/history.
 */
export async function bootstrapAdmission(db: AdmissionClient, input: unknown) {
  const parsed = AdmissionBootstrapSchema.safeParse(input);
  if (!parsed.success) throw new Error("ADMISSION_BOOTSTRAP_INVALID");
  const b = parsed.data;
  const unique = (rows: Array<{ id: string }>) => new Set(rows.map((r) => r.id)).size === rows.length;
  if (![b.principals, b.verificationMethods, b.communities, b.questions, b.capabilities].every(unique)) {
    throw new Error("ADMISSION_BOOTSTRAP_DUPLICATE_ID");
  }
  const principals = new Set(b.principals.map((p) => p.id));
  const communities = new Set(b.communities.map((c) => c.id));
  const questions = new Map(b.questions.map((q) => [q.id, q]));
  for (const key of b.verificationMethods) {
    if (!principals.has(key.principalId) || !key.publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----")
        || key.publicKeyPem.includes("PRIVATE KEY")) throw new Error("ADMISSION_BOOTSTRAP_KEY_INVALID");
    try {
      const publicKey = createPublicKey(key.publicKeyPem);
      if (publicKey.asymmetricKeyType !== "ed25519") throw new Error();
      // Refuse trailing objects, alternate encodings and mixed PEM material.
      if (publicKey.export({ type: "spki", format: "pem" }).toString() !== key.publicKeyPem) throw new Error();
    } catch { throw new Error("ADMISSION_BOOTSTRAP_KEY_INVALID"); }
  }
  for (const q of b.questions) {
    if (!principals.has(q.proposerPrincipalId) || !communities.has(q.intent.communityId)) {
      throw new Error("ADMISSION_BOOTSTRAP_REFERENCE_INVALID");
    }
  }
  for (const grant of b.capabilities) {
    if (!principals.has(grant.principalId) || !communities.has(grant.communityId)
        || (grant.questionId !== null && questions.get(grant.questionId)?.intent.communityId !== grant.communityId)) {
      throw new Error("ADMISSION_BOOTSTRAP_REFERENCE_INVALID");
    }
  }
  // This hashes the validated local initialization record. It is NOT a general
  // cross-language canonical serialization or independently attested genesis.
  const bootstrapHash = `sha256:${createHash("sha256").update("popular-consensus:admission-bootstrap:v0.2-draft\n" + JSON.stringify(b)).digest("hex")}`;
  return db.$transaction(async (tx) => {
    await tx.admissionNetwork.create({ data: { id: b.networkId, bootstrapHash } });
    await tx.admissionPrincipal.createMany({ data: b.principals.map((p) => ({ networkId: b.networkId, id: p.id })) });
    await tx.admissionCommunity.createMany({ data: b.communities.map((c) => ({ networkId: b.networkId, id: c.id })) });
    await tx.admissionVerificationMethod.createMany({ data: b.verificationMethods.map((key) => ({
      networkId: b.networkId, id: key.id, principalId: key.principalId, publicKeyPem: key.publicKeyPem,
      validFrom: new Date(key.validity.validFrom), validUntil: new Date(key.validity.validUntil)
    })) });
    await tx.admissionQuestion.createMany({ data: b.questions.map((q) => ({
      networkId: b.networkId, id: q.id, communityId: q.intent.communityId, proposerPrincipalId: q.proposerPrincipalId,
      intentJson: JSON.stringify(q.intent), challengeWindowEndsAt: new Date(q.challengeWindowEndsAt)
    })) });
    await tx.admissionCapabilityGrant.createMany({ data: b.capabilities.map((g) => ({
      networkId: b.networkId, id: g.id, principalId: g.principalId, communityId: g.communityId,
      questionId: g.questionId, action: g.action,
      validFrom: new Date(g.validity.validFrom), validUntil: new Date(g.validity.validUntil)
    })) });
    return { networkId: b.networkId, bootstrapHash };
  }, { isolationLevel: AdmissionPrisma.TransactionIsolationLevel.Serializable });
}

async function main() {
  readRuntimeConfig(process.env);
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--file") throw new Error("BOOTSTRAP_FILE_REQUIRED");
  const file = await open(args[1], "r");
  let input: unknown;
  try {
    if (!(await file.stat()).isFile()) throw new Error("BOOTSTRAP_FILE_INVALID");
    const buffer = Buffer.alloc(65_537);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 65_536) throw new Error("BOOTSTRAP_FILE_TOO_LARGE");
    input = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
  } finally { await file.close(); }
  const db = createAdmissionClient();
  try { console.log(JSON.stringify(await bootstrapAdmission(db, input))); }
  finally { await db.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("ADMISSION_BOOTSTRAP_FAILED: check the explicit local configuration and public bootstrap record; existing networks are never overwritten"); process.exitCode = 1; });
}
