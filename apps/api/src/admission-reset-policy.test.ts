import { describe, expect, it } from "vitest";
import { admissionDatabaseUrl, createAdmissionClient } from "../../../packages/db/src/admission";

describe("admission disposable test database guard", () => {
  it.each(["popcon_admission", "production", "popcon_test_backup", "popcon_TEST"])("refuses reset-capable tests against %s before constructing a client", (name) => {
    const env = { RUN_DB_TESTS: "true", ADMISSION_DATABASE_URL: `postgresql://pc:secret@127.0.0.1/${name}` };
    expect(() => createAdmissionClient(env)).toThrow("ADMISSION_DISPOSABLE_TEST_DATABASE_REQUIRED");
    try { admissionDatabaseUrl(env); } catch (error) {
      expect(String(error)).not.toContain("secret");
    }
  });

  it("accepts an explicitly named separate disposable test database", () => {
    const url = "postgresql://pc:pc@127.0.0.1/popcon_admission_test";
    expect(admissionDatabaseUrl({ RUN_DB_TESTS: "true", ADMISSION_DATABASE_URL: url,
      DATABASE_URL: "postgresql://pc:pc@localhost/popular_consensus" })).toBe(url);
  });

  it("still rejects sharing even a test database with legacy routes", () => {
    expect(() => admissionDatabaseUrl({ RUN_DB_TESTS: "true",
      ADMISSION_DATABASE_URL: "postgresql://127.0.0.1/shared_test",
      DATABASE_URL: "postgresql://localhost/shared_test" })).toThrow("ADMISSION_DATABASE_MUST_BE_SEPARATE");
  });

  it("does not rename or reset a non-test development database", () => {
    const url = "postgresql://127.0.0.1/popcon_admission";
    expect(admissionDatabaseUrl({ RUN_DB_TESTS: "false", ADMISSION_DATABASE_URL: url })).toBe(url);
  });
});
