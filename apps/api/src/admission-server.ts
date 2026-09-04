import Fastify from "fastify";
import { pathToFileURL } from "node:url";
import { createAdmissionClient, type AdmissionClient } from "../../../packages/db/src/admission";
import { FoundationIdSchema } from "../../../packages/shared/src/foundation";
import { applyQuestionAcceptance, type AdmissionRejection } from "./question-admission";
import { readRuntimeConfig } from "./runtime-policy";

function rejectionStatus(code: AdmissionRejection): number {
  if (code === "INVALID_COMMAND") return 400;
  if (code === "SIGNATURE_INVALID") return 401;
  if (["KEY_NOT_VALID", "CAPABILITY_DENIED", "ACTOR_MISMATCH", "SELF_APPROVAL", "PRINCIPAL_NOT_FOUND"].includes(code)) return 403;
  if (["INVALID_SNAPSHOT", "CONCURRENT_CONFLICT"].includes(code)) return 503;
  return 409;
}

/** Narrow LOCAL command service. Never registers legacy reads/writes, enrollment,
 * ballots, credential export, or debug endpoints. The caller owns the DB client.
 */
export function buildAdmissionServer(db: AdmissionClient, networkId: string) {
  FoundationIdSchema.parse(networkId);
  const app = Fastify({ logger: false, bodyLimit: 8_192, requestTimeout: 15_000, trustProxy: false });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    // Machine-client rehearsal only. No reflected CORS or browser-origin access.
    if (request.headers.origin !== undefined || request.headers["sec-fetch-site"] !== undefined) {
      return reply.code(403).send({ outcome: "Rejected", code: "BROWSER_CLIENT_NOT_ENABLED" });
    }
  });
  app.setErrorHandler((error, _request, reply) => {
    // Never echo payloads, SQL, keys, connection strings or parser details.
    const status = typeof error === "object" && error !== null && "statusCode" in error
      && typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500
      ? error.statusCode : 503;
    reply.code(status).send({ outcome: "Rejected", code: status < 500 ? "INVALID_REQUEST" : "STORE_UNAVAILABLE" });
  });
  app.get("/health", async () => ({ ok: true, profile: "local-signed-admission", publicReady: false }));
  app.post("/v0.2/commands/accept-question", async (request, reply) => {
    const result = await applyQuestionAcceptance(db, networkId, request.body);
    return reply.code(result.outcome === "Rejected" ? rejectionStatus(result.code) : 200).send(result);
  });
  return app;
}

async function main() {
  const runtime = readRuntimeConfig({ ...process.env, PORT: process.env.ADMISSION_PORT ?? "4001" });
  const networkId = FoundationIdSchema.safeParse(process.env.PC_NETWORK_ID);
  if (!networkId.success) throw new Error("PC_NETWORK_ID_REQUIRED");
  const db = createAdmissionClient();
  const app = buildAdmissionServer(db, networkId.data);
  app.addHook("onClose", async () => { await db.$disconnect(); });
  try {
    await db.$connect();
    if (!await db.admissionNetwork.findUnique({ where: { id: networkId.data } })) throw new Error("ADMISSION_NOT_BOOTSTRAPPED");
    await app.listen({ host: runtime.host, port: runtime.port });
    const shutdown = () => { void app.close().catch(() => { process.exitCode = 1; }); };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    await app.close();
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("ADMISSION_STARTUP_FAILED: check local runtime, network and migrated database configuration"); process.exitCode = 1; });
}
