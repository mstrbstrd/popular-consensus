import { productionSliceInputFromJson, verifyProductionSlice } from "@pc/protocol-slice";

export function rebuildProductionSliceState(value: unknown) {
  const input = productionSliceInputFromJson(value);
  return {
    input,
    report: verifyProductionSlice(input)
  };
}
