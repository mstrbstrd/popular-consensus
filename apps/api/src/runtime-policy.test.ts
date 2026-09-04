import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readRuntimeConfig } from "./runtime-policy";

const apiDir = fileURLToPath(new URL("..", import.meta.url));

describe("legacy API runtime boundary", () => {
  it("defaults to a loopback-only local demo", () => {
    expect(readRuntimeConfig({}, "/work/apps/api")).toMatchObject({
      runtimeMode: "local-demo", host: "127.0.0.1", port: 4000,
      devMode: true, demoMode: true, artifactDir: "/work/data/artifacts"
    });
  });
  it.each(["development", "test"])("disables implicit demo flags in %s", (mode) => {
    expect(readRuntimeConfig({ PC_RUNTIME_MODE: mode })).toMatchObject({ devMode: false, demoMode: false });
  });
  it.each(["true", "false"])("parses literal flags %s", (flag) => {
    expect(readRuntimeConfig({ PC_DEV_MODE: flag, PC_DEMO_MODE: flag }).demoMode).toBe(flag === "true");
  });
  it.each(["0.0.0.0", "::", "localhost", "192.168.1.1", "127.0.0.1 ", "", "127.0.0.2", "::ffff:127.0.0.1"])("rejects non-allowlisted host %j", (host) => {
    expect(() => readRuntimeConfig({ HOST: host })).toThrow("NON_LOOPBACK_BINDING_DENIED");
  });
  it.each(["127.0.0.1", "::1"])("accepts literal loopback %s", (host) => {
    expect(readRuntimeConfig({ HOST: host }).host).toBe(host);
  });
  it.each(["testnet", "advisory-public", "utility-production"])("refuses unsupported public mode %s even without demo flags", (mode) => {
    expect(() => readRuntimeConfig({ PC_RUNTIME_MODE: mode, PC_DEV_MODE: "false", PC_DEMO_MODE: "false" })).toThrow("PUBLIC_RUNTIME_NOT_READY");
  });
  it("refuses NODE_ENV=production despite a local-mode claim", () => {
    expect(() => readRuntimeConfig({ NODE_ENV: "production", PC_RUNTIME_MODE: "local-demo" })).toThrow("PUBLIC_RUNTIME_NOT_READY");
  });
  it.each(["", "prod", "production", "Test", "local-demo "])("rejects ambiguous runtime %j", (mode) => {
    expect(() => readRuntimeConfig({ PC_RUNTIME_MODE: mode })).toThrow("RUNTIME_MODE_INVALID");
  });
  it.each(["", "0", "-1", "65536", "4000.1", "4000x", " 4000", "04", "Infinity", "4000\n"])("rejects invalid port %j", (port) => {
    expect(() => readRuntimeConfig({ PORT: port })).toThrow("PORT_INVALID");
  });
  it.each(["1", "65535"])("accepts boundary port %s", (port) => {
    expect(readRuntimeConfig({ PORT: port }).port).toBe(Number(port));
  });
  for (const name of ["PC_DEV_MODE", "PC_DEMO_MODE"]) {
    it.each(["", "1", "0", "TRUE", "False", "false "])("rejects ambiguous " + name + "=%j", (value) => {
      expect(() => readRuntimeConfig({ [name]: value })).toThrow("BOOLEAN_INVALID");
    });
  }
  it.each([
    [{ HOST: "0.0.0.0" }, "NON_LOOPBACK_BINDING_DENIED"],
    [{ PC_RUNTIME_MODE: "testnet" }, "PUBLIC_RUNTIME_NOT_READY"],
    [{ NODE_ENV: "production" }, "PUBLIC_RUNTIME_NOT_READY"],
    [{ PC_DEMO_MODE: "yes" }, "BOOLEAN_INVALID"]
  ] as const)("actual config import fails closed for %j", (override, code) => {
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", "await import('./src/config.ts')"], {
      cwd: apiDir,
      env: { ...process.env, HOST: "127.0.0.1", PORT: "4000", NODE_ENV: "test", PC_RUNTIME_MODE: "test", PC_DEV_MODE: "false", PC_DEMO_MODE: "false", ...override },
      encoding: "utf8", timeout: 10_000
    });
    expect(child.error).toBeUndefined();
    expect(child.status).not.toBe(0);
    expect(child.stderr).toContain(code);
  });
});
