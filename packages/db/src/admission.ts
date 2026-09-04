import { PrismaClient, Prisma } from "../generated/admission";

/** Explicit, separate local database. No legacy account or database fallback. */
export function admissionDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const value = env.ADMISSION_DATABASE_URL;
  if (!value) throw new Error("ADMISSION_DATABASE_URL_REQUIRED");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("ADMISSION_DATABASE_URL_INVALID"); }
  if (!["postgresql:", "postgres:"].includes(url.protocol)
      || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      || url.search !== "" || url.hash !== ""
      || !/^\/[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(url.pathname)) {
    throw new Error("ADMISSION_DATABASE_URL_INVALID");
  }
  // Avoid accidental reuse even when different loopback spellings are used.
  if (env.DATABASE_URL) {
    try {
      const legacy = new URL(env.DATABASE_URL);
      if (legacy.pathname === url.pathname) throw new Error("ADMISSION_DATABASE_MUST_BE_SEPARATE");
    } catch (error) {
      if (error instanceof Error && error.message === "ADMISSION_DATABASE_MUST_BE_SEPARATE") throw error;
      throw new Error("LEGACY_DATABASE_URL_INVALID");
    }
  }
  return value;
}

export function createAdmissionClient(env: NodeJS.ProcessEnv = process.env) {
  return new PrismaClient({ datasources: { db: { url: admissionDatabaseUrl(env) } }, log: [] });
}

export { Prisma as AdmissionPrisma };
export type AdmissionClient = PrismaClient;
