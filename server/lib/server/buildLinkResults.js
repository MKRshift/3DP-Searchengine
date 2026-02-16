import { normalizeResult } from "../../services/normalize.service.js";

export function buildLinkResults({ quickLinks, query }) {
  return quickLinks
    .filter((link) => link.kind === "link")
    .map((link) =>
      normalizeResult({
        source: link.source,
        sourceLabel: link.label,
        sourceIconUrl: link.iconUrl,
        assetType: Array.isArray(link.assetTypes) && link.assetTypes.length ? link.assetTypes[0] : "model3d",
        title: `Search “${query}” on ${link.label}`,
        creatorName: "Direct platform search",
        url: link.url,
        thumbnail: null,
        meta: {
          formats: [],
          tags: ["external-search"],
        },
      })
    );
}
