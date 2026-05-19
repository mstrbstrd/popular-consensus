import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildServer } from "../../apps/api/src/server.ts";
import { resetDemoData } from "../../apps/api/src/seed.ts";
import { verifyApi } from "../../packages/replay/src/index.ts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts/grant-demo");
type GrantApiServer = ReturnType<typeof buildServer>;
type InjectResponse = {
  statusCode: number;
  body: string;
  json: () => unknown;
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await resetDemoData();

  const app = buildServer();
  try {
    const lifecycle = await createArchivedQuestion(app);
    await app.listen({ host: "127.0.0.1", port: 0 });
    const baseUrl = localBaseUrl(app);
    const replay = await verifyApi(baseUrl, lifecycle.questionId);

    if (replay.status !== "Verified") {
      throw new Error(`API replay expected Verified but got ${replay.status}`);
    }

    const reportPath = path.join(OUT_DIR, "api-replay-report.json");
    const transcriptPath = path.join(OUT_DIR, "api-replay-transcript.txt");
    const failedChecks = replay.checks.filter((check) => !check.ok).map((check) => check.id);
    const report = {
      protocol: "popular-consensus",
      schemaVersion: "ef-protocol-replay-kit-api-replay-report-v1",
      generatedAt: new Date().toISOString(),
      command: "pnpm grant:api-replay",
      status: replay.status,
      mode: replay.mode,
      baseUrl,
      questionId: lifecycle.questionId,
      pollId: lifecycle.pollId,
      resultArtifactHash: lifecycle.resultArtifactHash,
      archiveHash: lifecycle.archiveHash,
      eventStreamHash: replay.hashes.eventStreamHash,
      checksPassed: replay.checks.length - failedChecks.length,
      checksTotal: replay.checks.length,
      failedChecks,
      api: replay.api,
      lifecycle: lifecycle.steps
    };

    const transcript = [
      "Popular Consensus Protocol Replay Kit API replay demo",
      "",
      `Command: pnpm grant:api-replay`,
      `Base URL: ${baseUrl}`,
      `Question: ${lifecycle.questionId}`,
      `Poll: ${lifecycle.pollId}`,
      `Result artifact: ${lifecycle.resultArtifactHash}`,
      `Archive: ${lifecycle.archiveHash}`,
      `Replay status: ${replay.status}`,
      `Replay checks: ${report.checksPassed}/${report.checksTotal}`,
      `Event stream: ${replay.hashes.eventStreamHash}`,
      "",
      "Lifecycle:",
      ...lifecycle.steps.map((step) => `- ${step}`)
    ].join("\n");

    await writeJson(reportPath, report);
    await writeFile(transcriptPath, `${transcript}\n`, "utf8");

    console.log("EF Protocol Replay Kit API replay: Verified");
    console.log(`Report: ${relative(reportPath)}`);
    console.log(`Transcript: ${relative(transcriptPath)}`);
    console.log(`Question: ${lifecycle.questionId}`);
    console.log(`Checks: ${report.checksPassed}/${report.checksTotal}`);
  } finally {
    await app.close();
  }
}

async function createArchivedQuestion(app: GrantApiServer) {
  const steps: string[] = [];

  const created = await post(app, "/questions", {
    title: "Should Vancouver publish replayable civic decision records?",
    body: "Advisory protocol replay question for seeded API verification.",
    sponsorDisclosure: "Grant demo sponsor disclosure.",
    proposer: "demo-proposer"
  });
  const questionId = stringAt(created, "question.id");
  const pollId = stringAt(created, "question.poll.id");
  steps.push("question-created");

  await post(app, `/questions/${questionId}/accept`, { curator: "demo-curator" });
  steps.push("question-accepted-and-poll-opened");

  const credential = await post(app, "/credentials/demo-resident", { holderAlias: "grant-api-resident" });
  const credentialId = stringAt(credential, "credential.credentialId");
  const credentialSecret = stringAt(credential, "credential.secret");
  steps.push("credential-issued");

  await post(app, `/polls/${pollId}/signup`, { credentialId, credentialSecret });
  steps.push("credential-proof-generated");

  await post(app, `/polls/${pollId}/vote`, { credentialId, credentialSecret, choice: "support" });
  steps.push("encrypted-ballot-submitted");

  const duplicateVote = await app.inject({
    method: "POST",
    url: `/polls/${pollId}/vote`,
    payload: { credentialId, credentialSecret, choice: "oppose" }
  });
  if (duplicateVote.statusCode !== 409) {
    throw new Error(`duplicate nullifier expected 409 but got ${duplicateVote.statusCode}`);
  }
  steps.push("duplicate-nullifier-rejected");

  await post(app, `/polls/${pollId}/close`, {});
  steps.push("poll-closed");

  const tally = await post(app, `/polls/${pollId}/tally`, {});
  const resultArtifactHash = stringAt(tally, "result.resultArtifactHash");
  steps.push("result-tallied");

  await post(app, `/polls/${pollId}/finalize`, { curator: "demo-curator" });
  steps.push("result-finalized");

  const archive = await post(app, `/questions/${questionId}/archive`, { curator: "demo-curator" });
  const archiveHash = stringAt(archive, "archiveRecord.archiveHash");
  steps.push("question-archived");

  return {
    questionId,
    pollId,
    resultArtifactHash,
    archiveHash,
    steps
  };
}

async function post(app: GrantApiServer, url: string, payload: unknown) {
  const response = (await app.inject({ method: "POST", url, payload: payload as Record<string, unknown> })) as InjectResponse;
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`${url} expected 2xx but got ${response.statusCode}: ${response.body}`);
  }
  return response.json() as unknown;
}

function stringAt(value: unknown, dotPath: string) {
  const found = dotPath.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
  if (typeof found !== "string") throw new Error(`Expected string at ${dotPath}`);
  return found;
}

function localBaseUrl(app: GrantApiServer) {
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("API server address was not available");
  return `http://127.0.0.1:${address.port}`;
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function relative(filePath: string) {
  return path.relative(REPO_ROOT, filePath);
}
