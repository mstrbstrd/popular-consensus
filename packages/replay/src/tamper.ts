import { hashJson, type ArtifactExportBundle } from "@pc/artifacts";
import { productionSliceInputFromJson } from "@pc/protocol-slice";
import { isRecord } from "./checks";
import { isArtifactExportBundle, isProductionSliceLike } from "./verifyBundle";

export function tamperReplayValue(value: unknown, field = "resultArtifactHash"): unknown {
  const cloned = cloneJson(value);
  if (isProductionSliceLike(cloned)) {
    const input = productionSliceInputFromJson(cloned);
    if (field === "resultArtifactHash") {
      input.result.resultArtifactHash = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
      return cloned;
    }
    if (field === "eventStream") {
      input.events = [...input.events].reverse();
      return cloned;
    }
    return tamperResultArtifactValue(input.bundle);
  }
  if (isArtifactExportBundle(cloned)) {
    if (field === "resultArtifactHash") {
      const result = cloned.artifacts.find((entry) => entry.kind === "result-artifact");
      if (result) result.hash = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
      return cloned;
    }
    return tamperResultArtifactValue(cloned);
  }
  return cloned;
}

function tamperResultArtifactValue(bundle: ArtifactExportBundle) {
  const result = bundle.artifacts.find((entry) => entry.kind === "result-artifact");
  if (result && isRecord(result.value)) {
    result.value = { ...result.value, tampered: true };
    result.computedHash = hashJson(result.value);
  }
  return bundle;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
