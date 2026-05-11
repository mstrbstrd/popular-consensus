import { spawnSync } from "node:child_process";

const terms = [
  "od" + "ds",
  "pay" + "out",
  "wa" + "ger",
  "bet" + "ting",
  "trader " + "position",
  "answer " + "token"
];

const result = spawnSync("rg", ["-n", terms.join("|"), "."], { stdio: "inherit" });

if (result.status === 0) {
  process.exit(1);
}

if (result.status === 1) {
  process.exit(0);
}

process.exit(result.status ?? 1);

