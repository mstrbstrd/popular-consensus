import path from "node:path";
import { readFileSync } from "node:fs";

const devMode = process.env.PC_DEV_MODE !== "false";
const allowedAuthOrigins = process.env.PC_AUTH_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002"
];

type LocalDeployment = {
  chainId?: number;
  contracts?: Record<string, string | undefined>;
};

const deployment = loadLocalDeployment();
const deploymentContracts = deployment?.contracts ?? {};

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  artifactDir: process.env.ARTIFACT_DIR ?? path.join(process.cwd(), "..", "..", "data", "artifacts"),
  devMode,
  demoMode: process.env.PC_DEMO_MODE ? process.env.PC_DEMO_MODE !== "false" : devMode,
  requireAuth: process.env.PC_REQUIRE_AUTH === "true" || !devMode,
  authOrigins: allowedAuthOrigins,
  authSessionTtlHours: Number(process.env.PC_AUTH_SESSION_TTL_HOURS ?? 24),
  accountAbstraction: {
    chainId: Number(process.env.PC_AA_CHAIN_ID ?? deployment?.chainId ?? 31337),
    rpcUrl: process.env.PC_AA_RPC_URL ?? process.env.RPC_URL ?? "http://127.0.0.1:8545",
    bundlerUrl: process.env.PC_AA_BUNDLER_URL ?? null,
    entryPoint: addressFromEnvOrDeployment("PC_AA_ENTRY_POINT", deploymentContracts.entryPoint),
    accountFactory: addressFromEnvOrDeployment("PC_AA_ACCOUNT_FACTORY", deploymentContracts.accountFactory),
    paymaster: addressFromEnvOrDeployment("PC_AA_PAYMASTER", deploymentContracts.paymaster),
    p256Verifier: addressFromEnvOrDeployment("PC_AA_P256_VERIFIER", deploymentContracts.p256Verifier),
    bundlerPrivateKey: process.env.PC_AA_BUNDLER_PRIVATE_KEY ?? null
  }
};

function loadLocalDeployment(): LocalDeployment | null {
  const deploymentPath = process.env.PC_LOCAL_DEPLOYMENT_FILE ?? path.join(process.cwd(), "..", "..", "data", "local-deployment.json");
  try {
    return JSON.parse(readFileSync(deploymentPath, "utf8")) as LocalDeployment;
  } catch {
    return null;
  }
}

function addressFromEnvOrDeployment(envName: string, deploymentValue?: string) {
  const value = process.env[envName] ?? deploymentValue;
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) ? value : null;
}
