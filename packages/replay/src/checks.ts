import type { ReplayCheck, ReplayReport } from "./types";

export function replayReport(mode: ReplayReport["mode"], checks: ReplayCheck[], hashes: ReplayReport["hashes"] = {}): ReplayReport {
  return {
    protocol: "popular-consensus",
    schemaVersion: "pc-replay-report-v1",
    mode,
    status: checks.every((check) => check.ok) ? "Verified" : "Mismatch",
    generatedAt: Date.now(),
    checks,
    hashes
  };
}

export function parseValue<T>(id: string, value: unknown, schema: { parse: (value: unknown) => T }) {
  try {
    return {
      value: schema.parse(value),
      check: { id, ok: true, expected: "valid public API response", actual: "valid" } satisfies ReplayCheck
    };
  } catch (error) {
    return {
      value: null,
      check: {
        id,
        ok: false,
        expected: "valid public API response",
        actual: shapeOf(value),
        detail: error instanceof Error ? error.message : String(error)
      } satisfies ReplayCheck
    };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function shapeOf(value: unknown) {
  return isRecord(value) ? { keys: Object.keys(value).slice(0, 10), schemaVersion: value.schemaVersion } : typeof value;
}

export function stringRecordValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}
