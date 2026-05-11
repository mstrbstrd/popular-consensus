import path from "node:path";

const devMode = process.env.PC_DEV_MODE !== "false";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  artifactDir: process.env.ARTIFACT_DIR ?? path.join(process.cwd(), "..", "..", "data", "artifacts"),
  devMode,
  demoMode: process.env.PC_DEMO_MODE ? process.env.PC_DEMO_MODE !== "false" : devMode
};
