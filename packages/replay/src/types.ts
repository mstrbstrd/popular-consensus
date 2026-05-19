import type { ProductionSliceVerificationReport } from "@pc/protocol-slice";

export type ReplayStatus = "Verified" | "Mismatch";

export type ReplayCheck = {
  id: string;
  ok: boolean;
  expected?: unknown;
  actual?: unknown;
  detail?: string;
};

export type ReplayReport = {
  protocol: "popular-consensus";
  schemaVersion: "pc-replay-report-v1";
  mode: "production-slice" | "artifact-bundle" | "api" | "unsupported";
  status: ReplayStatus;
  generatedAt: number;
  checks: ReplayCheck[];
  hashes: {
    manifestHash?: string | null;
    rootHash?: string | null;
    eventStreamHash?: string | null;
    transactionStreamHash?: string | null;
  };
  productionSlice?: ProductionSliceVerificationReport;
  api?: {
    baseUrl: string;
    questionId: string;
    civicRecordUrl: string;
    replayCheckUrl: string;
  };
};

export type ReplayApiFetch = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type ReplayApiOptions = {
  fetch?: ReplayApiFetch;
};
