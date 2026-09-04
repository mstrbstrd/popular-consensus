import path from "node:path";

/** The legacy routes have no production authentication. Do not expose them. */
export function readRuntimeConfig(env: NodeJS.ProcessEnv, cwd = process.cwd()) {
  const runtimeMode = env.PC_RUNTIME_MODE ?? "local-demo";
  if (env.NODE_ENV === "production" || ["testnet", "advisory-public", "utility-production"].includes(runtimeMode)) {
    throw new Error("PUBLIC_RUNTIME_NOT_READY: legacy API authorization is not migrated; public operation is disabled");
  }
  if (!["local-demo", "development", "test"].includes(runtimeMode)) {
    throw new Error("RUNTIME_MODE_INVALID: use local-demo, development, or test");
  }
  const host = env.HOST ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "::1") {
    throw new Error("NON_LOOPBACK_BINDING_DENIED: legacy API must bind to a literal loopback address");
  }
  const portText = env.PORT ?? "4000";
  if (!/^[1-9][0-9]{0,4}(?![\s\S])/.test(portText) || Number(portText) > 65535) {
    throw new Error("PORT_INVALID: expected an integer from 1 through 65535");
  }
  const readFlag = (name: string, fallback: boolean): boolean => {
    const value = env[name];
    if (value === undefined) return fallback;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error(`BOOLEAN_INVALID: ${name} must be true or false`);
  };
  const devMode = readFlag("PC_DEV_MODE", runtimeMode === "local-demo");
  return {
    runtimeMode,
    port: Number(portText),
    host,
    artifactDir: env.ARTIFACT_DIR ?? path.join(cwd, "..", "..", "data", "artifacts"),
    devMode,
    demoMode: readFlag("PC_DEMO_MODE", devMode)
  };
}
