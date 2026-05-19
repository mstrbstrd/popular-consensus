import { PublicApiV0CivicRecordResponseSchema, PublicApiV0ReplayCheckResponseSchema } from "@pc/shared";
import { parseValue, replayReport, stringRecordValue } from "./checks";
import type { ReplayApiFetch, ReplayApiOptions, ReplayCheck, ReplayReport } from "./types";

export async function verifyApi(baseUrl: string, questionId: string, options: ReplayApiOptions = {}): Promise<ReplayReport> {
  const checks: ReplayCheck[] = [];
  const add = (id: string, ok: boolean, expected?: unknown, actual?: unknown, detail?: string) => checks.push({ id, ok, expected, actual, detail });
  const civicRecordUrl = apiUrl(baseUrl, `/public/questions/${encodeURIComponent(questionId)}/civic-record`);
  const replayCheckUrl = apiUrl(baseUrl, `/public/questions/${encodeURIComponent(questionId)}/replay-check`);
  const fetcher = options.fetch ?? defaultFetch;
  const [civicRecordFetch, replayCheckFetch] = await Promise.all([fetchJson(fetcher, civicRecordUrl), fetchJson(fetcher, replayCheckUrl)]);

  add("api-civic-record-http", civicRecordFetch.ok, 200, civicRecordFetch.status, civicRecordFetch.error);
  add("api-replay-check-http", replayCheckFetch.ok, 200, replayCheckFetch.status, replayCheckFetch.error);

  let civicRecord: ReturnType<typeof PublicApiV0CivicRecordResponseSchema.parse> | null = null;
  let replayCheck: ReturnType<typeof PublicApiV0ReplayCheckResponseSchema.parse> | null = null;

  if (civicRecordFetch.ok) {
    const parsed = parseValue("api-civic-record-schema", civicRecordFetch.value, PublicApiV0CivicRecordResponseSchema);
    add(parsed.check.id, parsed.check.ok, parsed.check.expected, parsed.check.actual, parsed.check.detail);
    civicRecord = parsed.value;
  }

  if (replayCheckFetch.ok) {
    const parsed = parseValue("api-replay-check-schema", replayCheckFetch.value, PublicApiV0ReplayCheckResponseSchema);
    add(parsed.check.id, parsed.check.ok, parsed.check.expected, parsed.check.actual, parsed.check.detail);
    replayCheck = parsed.value;
  }

  if (civicRecord && replayCheck) {
    const civicQuestionId = stringRecordValue(civicRecord.protocol.ids, "questionId");
    const replayProtocolQuestionId = stringRecordValue(replayCheck.protocol.ids, "questionId");
    const civicEventStreamHash = stringRecordValue(civicRecord.protocol.hashes, "eventStreamHash");
    const replayProtocolEventStreamHash = stringRecordValue(replayCheck.protocol.hashes, "eventStreamHash");
    const civicResultArtifactHash = stringRecordValue(civicRecord.protocol.hashes, "resultArtifactHash");
    const replayProtocolResultArtifactHash = stringRecordValue(replayCheck.protocol.hashes, "resultArtifactHash");
    const civicArchiveHash = stringRecordValue(civicRecord.protocol.hashes, "archiveHash");
    const replayProtocolArchiveHash = stringRecordValue(replayCheck.protocol.hashes, "archiveHash");
    const failedReplayChecks = replayCheck.checks.filter((check) => !check.ok).map((check) => check.id);

    add("api-question-id", civicRecord.question.id === questionId && civicQuestionId === questionId && replayCheck.questionId === questionId && replayProtocolQuestionId === questionId, questionId, {
      civicRecordQuestionId: civicRecord.question.id,
      civicProtocolQuestionId: civicQuestionId,
      replayCheckQuestionId: replayCheck.questionId,
      replayProtocolQuestionId
    });
    add("api-replay-status", replayCheck.status === "Verified", "Verified", replayCheck.status);
    add("api-replay-checks-passed", failedReplayChecks.length === 0, [], failedReplayChecks);
    add(
      "api-event-stream-hash",
      Boolean(civicEventStreamHash && civicEventStreamHash === replayCheck.eventStreamHash && civicEventStreamHash === replayProtocolEventStreamHash),
      civicEventStreamHash,
      { replayCheckEventStreamHash: replayCheck.eventStreamHash, replayProtocolEventStreamHash }
    );

    if (civicRecord.result) {
      add(
        "api-result-artifact-hash",
        Boolean(
          civicResultArtifactHash &&
            civicResultArtifactHash === civicRecord.result.resultArtifactHash &&
            civicResultArtifactHash === replayCheck.rebuilt.resultArtifactHash &&
            civicResultArtifactHash === replayProtocolResultArtifactHash
        ),
        civicResultArtifactHash,
        {
          resultRecordHash: civicRecord.result.resultArtifactHash,
          replayRebuiltHash: replayCheck.rebuilt.resultArtifactHash,
          replayProtocolHash: replayProtocolResultArtifactHash
        }
      );
    }

    if (civicRecord.archiveRecord) {
      add(
        "api-archive-hash",
        Boolean(
          civicArchiveHash &&
            civicArchiveHash === civicRecord.archiveRecord.archiveHash &&
            civicArchiveHash === replayCheck.rebuilt.archiveHash &&
            civicArchiveHash === replayProtocolArchiveHash
        ),
        civicArchiveHash,
        {
          archiveRecordHash: civicRecord.archiveRecord.archiveHash,
          replayRebuiltHash: replayCheck.rebuilt.archiveHash,
          replayProtocolHash: replayProtocolArchiveHash
        }
      );
    }
  }

  return {
    ...replayReport("api", checks, {
      eventStreamHash:
        replayCheck && civicRecord ? stringRecordValue(civicRecord.protocol.hashes, "eventStreamHash") ?? replayCheck.eventStreamHash : null,
      rootHash: replayCheck?.rebuilt.archiveHash ?? null
    }),
    api: { baseUrl, questionId, civicRecordUrl, replayCheckUrl }
  };
}

async function fetchJson(fetcher: ReplayApiFetch, url: string) {
  try {
    const response = await fetcher(url);
    return {
      ok: response.ok,
      status: response.status,
      value: response.ok ? await response.json() : null
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      value: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function defaultFetch(url: string) {
  if (!globalThis.fetch) throw new Error("global fetch is not available in this runtime");
  return globalThis.fetch(url);
}

function apiUrl(baseUrl: string, pathName: string) {
  const url = new URL(baseUrl);
  url.pathname = `${url.pathname.replace(/\/$/, "")}${pathName}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
