import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const PACKET_DIR = path.join(REPO_ROOT, "grant/ef-protocol-replay-kit");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");

type PacketLintCheck = {
  id: string;
  ok: boolean;
  detail: string;
  evidence?: string;
};

const packetDocs = [
  "README.md",
  "00-abstract.md",
  "01-protocol-boundary.md",
  "02-event-schema.md",
  "03-artifact-schema.md",
  "04-replay-rules.md",
  "05-threat-model.md",
  "06-demo-transcript.md",
  "07-budget-and-milestones.md",
  "08-review-readiness.md",
  "09-license-plan.md",
  "10-api-replay-transcript.md",
  "11-cryptography-review.md",
  "12-external-review-intake.md",
  "13-contract-hardening-status.md",
  "14-reviewer-handoff.md",
  "15-threshold-custody-hardening.md",
  "16-replay-test-vectors.md",
  "17-repo-strategy-audit.md",
  "18-external-review-index.md",
  "19-grant-track-issue.md",
  "20-submission-gate.md",
  "21-protocol-package-publication.md",
  "office-hours-brief.md",
  "scope-boundary.md"
];

const abstractForbiddenTerms = ["paid reports", "rewards", "customers", "data monetization"];

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const checks: PacketLintCheck[] = [];

  for (const file of packetDocs) {
    const text = await readPacketFile(file);
    const words = wordCount(text);
    checks.push(check(`packet-doc-short-${slug(file)}`, words > 0 && words <= 1500, `${file} has ${words} words and must stay under 1500`, relativePacket(file)));
    checks.push(
      check(
        `packet-doc-reuse-section-${slug(file)}`,
        text.includes("## What Other Builders Can Reuse"),
        `${file} includes a reusable-builder section`,
        relativePacket(file)
      )
    );
  }

  const abstract = await readPacketFile("00-abstract.md");
  for (const term of abstractForbiddenTerms) {
    checks.push(
      check(
        `abstract-excludes-${slug(term)}`,
        !abstract.toLowerCase().includes(term),
        `Abstract does not mention ${term}`,
        relativePacket("00-abstract.md")
      )
    );
  }

  const boundary = await readPacketFile("01-protocol-boundary.md");
  checks.push(
    check(
      "boundary-protocol-must-not-import-platform",
      boundary.includes("Protocol must not depend on platform"),
      "Protocol/platform dependency direction is explicit",
      relativePacket("01-protocol-boundary.md")
    )
  );

  const readme = await readPacketFile("README.md");
  checks.push(check("readme-quick-check-command", readme.includes("pnpm grant:check"), "README exposes quick reviewer command", relativePacket("README.md")));
  checks.push(check("readme-full-check-command", readme.includes("pnpm grant:full-check"), "README exposes full local evidence command", relativePacket("README.md")));
  checks.push(
    check(
      "readme-reviewer-handoff-command",
      readme.includes("pnpm grant:reviewer-handoff"),
      "README exposes reviewer handoff command",
      relativePacket("README.md")
    )
  );
  checks.push(
    check(
      "readme-threshold-custody-command",
      readme.includes("pnpm grant:threshold-custody"),
      "README exposes threshold custody evidence command",
      relativePacket("README.md")
    )
  );
  checks.push(
    check(
      "readme-replay-test-vectors-command",
      readme.includes("pnpm grant:replay-test-vectors"),
      "README exposes replay test vector command",
      relativePacket("README.md")
    )
  );
  checks.push(
    check(
      "readme-repo-strategy-audit-command",
      readme.includes("pnpm grant:repo-strategy-audit"),
      "README exposes repo strategy audit command",
      relativePacket("README.md")
    )
  );
  checks.push(
    check(
      "readme-external-review-index-command",
      readme.includes("pnpm grant:external-review-index"),
      "README exposes external review index command",
      relativePacket("README.md")
    )
  );
  checks.push(
    check(
      "readme-submission-gate-command",
      readme.includes("pnpm grant:submission-gate"),
      "README exposes submission gate command",
      relativePacket("README.md")
    )
  );
  checks.push(
    check(
      "readme-protocol-publication-command",
      readme.includes("pnpm grant:protocol-publication"),
      "README exposes protocol publication status command",
      relativePacket("README.md")
    )
  );

  const readiness = await readPacketFile("08-review-readiness.md");
  checks.push(
    check(
      "readiness-formal-submission-blocked",
      readiness.includes("external cryptography review/threshold ceremony evidence and EF feedback remain open"),
      "Readiness doc keeps formal submission blockers explicit",
      relativePacket("08-review-readiness.md")
    )
  );

  const failedChecks = checks.filter((entry) => !entry.ok);
  const report = {
    protocol: "popular-consensus",
    schemaVersion: "ef-protocol-replay-kit-packet-lint-report-v1",
    generatedAt: new Date().toISOString(),
    command: "pnpm grant:packet-lint",
    status: failedChecks.length === 0 ? "PacketReady" : "Mismatch",
    checksPassed: checks.length - failedChecks.length,
    checksTotal: checks.length,
    failedChecks: failedChecks.map((entry) => entry.id),
    checks
  };
  const reportPath = path.join(OUT_DIR, "packet-lint-report.json");
  const transcriptPath = path.join(OUT_DIR, "packet-lint-transcript.txt");
  await writeJson(reportPath, report);
  await writeFile(
    transcriptPath,
    [
      "Popular Consensus Protocol Replay Kit packet lint",
      "",
      "Command: pnpm grant:packet-lint",
      `Status: ${report.status}`,
      `Checks: ${report.checksPassed}/${report.checksTotal}`,
      "",
      "Failed checks:",
      ...(failedChecks.length > 0 ? failedChecks.map((entry) => `- ${entry.id}: ${entry.detail}`) : ["- none"])
    ].join("\n") + "\n",
    "utf8"
  );

  if (failedChecks.length > 0) {
    throw new Error(`Packet lint failed: ${failedChecks.map((entry) => entry.id).join(", ")}`);
  }

  console.log("EF Protocol Replay Kit packet lint: PacketReady");
  console.log(`Report: ${path.relative(REPO_ROOT, reportPath)}`);
  console.log(`Transcript: ${path.relative(REPO_ROOT, transcriptPath)}`);
}

async function readPacketFile(file: string): Promise<string> {
  return readFile(path.join(PACKET_DIR, file), "utf8");
}

function check(id: string, ok: boolean, detail: string, evidence?: string): PacketLintCheck {
  return { id, ok, detail, evidence };
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function slug(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function relativePacket(file: string) {
  return path.relative(REPO_ROOT, path.join(PACKET_DIR, file));
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
