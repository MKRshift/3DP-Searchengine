import { normalizeResult } from "../normalize.js";

export function enrichResult(item, providers) {
  const provider = providers[item.source];
  return normalizeResult({
    ...item,
    sourceLabel: provider?.label ?? item.source,
    sourceIconUrl: provider?.iconUrl ?? null,
    creatorName: item?.creatorName ?? item?.author ?? null,
  });
}
