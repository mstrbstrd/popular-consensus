import { spawnSync } from "node:child_process";

const terms = ["TO" + "DO", "T" + "BD", "FIX" + "ME"];
const paths = ["README.md", ".github", "apps", "docs", "e2e", "infra", "packages", "scripts"];
const result = spawnSync("rg", ["-n", terms.join("|"), ...paths], { stdio: "inherit" });

if (result.status === 0) {
  process.exit(1);
}

if (result.status === 1) {
  process.exit(0);
}

process.exit(result.status ?? 1);
