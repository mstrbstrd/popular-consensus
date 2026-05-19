import { describe, expect, it } from "vitest";
import { createProductionSliceExport, createProductionSliceFixture } from "@pc/protocol-slice";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { tamperReplayValue, verifyApi, verifyReplayValue, type ReplayApiFetch } from "./index";

const FIXTURE_DIR = path.resolve(process.cwd(), "test/fixtures");

describe("replay verification", () => {
  it("verifies the production-slice export envelope", () => {
    const exported = createProductionSliceExport(createProductionSliceFixture().input);
    const report = verifyReplayValue(exported);

    expect(report.mode).toBe("production-slice");
    expect(report.status).toBe("Verified");
  });

  it("detects a tampered production-slice result hash", () => {
    const exported = createProductionSliceExport(createProductionSliceFixture().input);
    const report = verifyReplayValue(tamperReplayValue(exported, "resultArtifactHash"));

    expect(report.status).toBe("Mismatch");
    expect(report.checks.some((check) => !check.ok)).toBe(true);
  });

  it("detects reordered production-slice events", () => {
    const exported = createProductionSliceExport(createProductionSliceFixture().input);
    const report = verifyReplayValue(tamperReplayValue(exported, "eventStream"));

    expect(report.status).toBe("Mismatch");
    expect(report.checks.some((check) => !check.ok && check.id === "event-previous-hash-continuity")).toBe(true);
  });

  it("verifies artifact bundle integrity on its own", () => {
    const { input } = createProductionSliceFixture();
    const report = verifyReplayValue(input.bundle);

    expect(report.mode).toBe("artifact-bundle");
    expect(report.status).toBe("Verified");
  });

  it("detects a tampered artifact bundle hash", () => {
    const { input } = createProductionSliceFixture();
    const report = verifyReplayValue(tamperReplayValue(input.bundle, "resultArtifactHash"));

    expect(report.mode).toBe("artifact-bundle");
    expect(report.status).toBe("Mismatch");
  });

  it("detects a missing archive artifact", () => {
    const { input } = createProductionSliceFixture();
    const bundle = JSON.parse(JSON.stringify(input.bundle)) as typeof input.bundle;
    bundle.root = undefined;

    const report = verifyReplayValue(bundle);

    expect(report.mode).toBe("artifact-bundle");
    expect(report.status).toBe("Mismatch");
    expect(report.checks.some((check) => !check.ok && check.id === "root-present")).toBe(true);
  });

  it("verifies checked replay test vectors", async () => {
    const vectors = [
      { file: "clean-production-slice-export.json", mode: "production-slice", status: "Verified" },
      { file: "clean-community-export.json", mode: "artifact-bundle", status: "Verified" },
      { file: "tampered-result-hash.json", mode: "production-slice", status: "Mismatch" },
      { file: "missing-archive-artifact.json", mode: "artifact-bundle", status: "Mismatch" },
      { file: "reordered-events.json", mode: "production-slice", status: "Mismatch" }
    ];

    for (const vector of vectors) {
      const value = await readFixture(vector.file);
      const report = verifyReplayValue(value);

      expect(report.mode).toBe(vector.mode);
      expect(report.status).toBe(vector.status);
    }
  });

  it("verifies a public civic-record API replay response", async () => {
    const report = await verifyApi("http://api.test", "question-1", { fetch: mockApiFetch() });

    expect(report.mode).toBe("api");
    expect(report.status).toBe("Verified");
    expect(report.checks.every((check) => check.ok)).toBe(true);
    expect(report.hashes.eventStreamHash).toBe("sha256:event-stream");
    expect(report.hashes.rootHash).toBe("sha256:archive");
  });

  it("detects inconsistent public API replay hashes", async () => {
    const report = await verifyApi("http://api.test", "question-1", {
      fetch: mockApiFetch({ replayCheck: { ...apiReplayCheck(), eventStreamHash: "sha256:other-event-stream" } })
    });

    expect(report.mode).toBe("api");
    expect(report.status).toBe("Mismatch");
    expect(report.checks.some((check) => !check.ok && check.id === "api-event-stream-hash")).toBe(true);
  });

  it("detects public API result artifact hash drift", async () => {
    const replayCheck = apiReplayCheck();
    replayCheck.rebuilt.resultArtifactHash = "sha256:other-result";

    const report = await verifyApi("http://api.test", "question-1", { fetch: mockApiFetch({ replayCheck }) });

    expect(report.mode).toBe("api");
    expect(report.status).toBe("Mismatch");
    expect(report.checks.some((check) => !check.ok && check.id === "api-result-artifact-hash")).toBe(true);
  });

  it("detects public API archive hash drift", async () => {
    const civicRecord = apiCivicRecord();
    civicRecord.archiveRecord.archiveHash = "sha256:other-archive";

    const report = await verifyApi("http://api.test", "question-1", { fetch: mockApiFetch({ civicRecord }) });

    expect(report.mode).toBe("api");
    expect(report.status).toBe("Mismatch");
    expect(report.checks.some((check) => !check.ok && check.id === "api-archive-hash")).toBe(true);
  });

  it("detects public API replay-check mismatch status", async () => {
    const replayCheck = apiReplayCheck();
    replayCheck.status = "Mismatch";
    replayCheck.protocol.statuses.replayStatus = "Mismatch";
    replayCheck.protocol.statuses.failedChecks = ["event-previous-hash-continuity"];
    replayCheck.checks = [{ id: "event-previous-hash-continuity", ok: false }];

    const report = await verifyApi("http://api.test", "question-1", { fetch: mockApiFetch({ replayCheck }) });

    expect(report.mode).toBe("api");
    expect(report.status).toBe("Mismatch");
    expect(report.checks.some((check) => !check.ok && check.id === "api-replay-status")).toBe(true);
    expect(report.checks.some((check) => !check.ok && check.id === "api-replay-checks-passed")).toBe(true);
  });
});

async function readFixture(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(FIXTURE_DIR, file), "utf8")) as unknown;
}

function mockApiFetch(overrides: { civicRecord?: unknown; replayCheck?: unknown } = {}): ReplayApiFetch {
  const civicRecord = overrides.civicRecord ?? apiCivicRecord();
  const replayCheck = overrides.replayCheck ?? apiReplayCheck();
  return async (url: string) => {
    if (url === "http://api.test/public/questions/question-1/civic-record") return jsonResponse(civicRecord);
    if (url === "http://api.test/public/questions/question-1/replay-check") return jsonResponse(replayCheck);
    return { ok: false, status: 404, json: async () => ({ error: "not found" }) };
  };
}

function jsonResponse(value: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => value
  };
}

function apiCivicRecord() {
  return {
    protocol: {
      protocol: "popular-consensus",
      schemaVersion: "public-civic-record-v0",
      ids: {
        questionId: "question-1",
        communityId: "community-1",
        pollId: "poll-1",
        archiveRecordId: "archive-1"
      },
      hashes: {
        eventStreamHash: "sha256:event-stream",
        resultArtifactHash: "sha256:result",
        archiveHash: "sha256:archive"
      },
      statuses: {
        questionStatus: "Archived",
        resultFinalStatus: "Finalized",
        archiveStatus: "Archived"
      },
      authority: {
        authorityLevel: "Advisory"
      }
    },
    question: {
      id: "question-1",
      title: "Should this public record verify?",
      status: "Archived",
      communityId: "community-1",
      authorityLevel: "Advisory",
      credentialSchemaId: "credential-1",
      answerSchemaId: "answer-single-choice-civic-priority"
    },
    events: [
      {
        id: "event-1",
        eventType: "QuestionArchived",
        subjectId: "question-1",
        actor: "demo-curator",
        previousHash: null,
        newHash: "sha256:archive",
        emittedAt: "2026-05-19T12:00:00.000Z"
      }
    ],
    commitments: [],
    challenges: [],
    resultChallenges: [],
    result: {
      pollId: "poll-1",
      resultArtifactHash: "sha256:result",
      aggregateCountsHash: "sha256:aggregate-counts",
      tallyProofHash: "sha256:tally-proof",
      turnout: 3,
      invalidBallots: 0,
      privacyReportHash: "sha256:privacy-report",
      finalStatus: "Finalized",
      authorityLevel: "Advisory"
    },
    archiveRecord: {
      id: "archive-1",
      questionId: "question-1",
      archiveHash: "sha256:archive",
      archivedBy: "demo-curator",
      createdAt: "2026-05-19T12:00:00.000Z"
    },
    discussionCount: 0
  };
}

function apiReplayCheck() {
  return {
    protocol: {
      protocol: "popular-consensus",
      schemaVersion: "replay-check-v0",
      ids: {
        questionId: "question-1",
        communityId: "community-1",
        pollId: "poll-1",
        archiveRecordId: "archive-1",
        eventIds: ["event-1"]
      },
      hashes: {
        eventStreamHash: "sha256:event-stream",
        resultArtifactHash: "sha256:result",
        archiveHash: "sha256:archive"
      },
      statuses: {
        replayStatus: "Verified",
        checkCount: 1,
        failedChecks: [] as string[],
        rebuiltQuestionStatus: "Archived",
        rebuiltPollStatus: "ResultPublished",
        rebuiltResultFinalStatus: "Finalized"
      },
      authority: {
        authorityLevel: "Advisory"
      }
    },
    questionId: "question-1",
    status: "Verified",
    eventStreamHash: "sha256:event-stream",
    rebuilt: {
      questionStatus: "Archived",
      pollStatus: "ResultPublished",
      resultFinalStatus: "Finalized",
      bodyHash: "sha256:body",
      resultArtifactHash: "sha256:result",
      archiveHash: "sha256:archive"
    },
    checks: [{ id: "events-present", ok: true }]
  };
}
