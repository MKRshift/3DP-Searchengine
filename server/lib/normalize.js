function cleanString(value) {
  const text = (value ?? "").toString().trim();
  return text || null;
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function cleanDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cleanArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map((item) => String(item)) : [];
}

function normalizeAssetType(value) {
  const v = (value ?? "").toString().toLowerCase();
  if (["laser", "laser2d"].includes(v)) return "laser2d";
  if (["cnc"].includes(v)) return "cnc";
  if (["scan", "scan3d", "openaccess"].includes(v)) return "scan3d";
  if (["cad"].includes(v)) return "cad";
  return "model3d";
}

export function normalizeResult(item) {
  const meta = item?.meta ?? {};

  return {
    id: cleanString(item?.id) ?? `${item?.source ?? "unknown"}:${cleanString(item?.url) ?? cleanString(item?.title) ?? "item"}`,
    source: cleanString(item?.source) ?? "unknown",
    title: cleanString(item?.title) ?? "Untitled",
    url: cleanString(item?.url),
    thumbnail: cleanString(item?.thumbnail),
    creatorName: cleanString(item?.creatorName ?? item?.author),
    creatorUrl: cleanString(item?.creatorUrl ?? meta.creatorUrl),
    stats: {
      likes: cleanNumber(meta.likes),
      downloads: cleanNumber(meta.downloads ?? meta.download_count ?? meta.collects),
      views: cleanNumber(meta.views ?? meta.visits),
    },
    assetType: normalizeAssetType(item?.assetType ?? meta.assetType),
    license: cleanString(meta.license ?? meta.store_license),
    price: cleanNumber(meta.price),
    currency: cleanString(meta.currency),
    tags: cleanArray(meta.tags),
    updatedAt: cleanDate(meta.updatedAt),
    publishedAt: cleanDate(meta.publishedAt ?? meta.createdAt),
    formats: cleanArray(meta.formats),
    fileTypes: cleanArray(item?.fileTypes ?? meta.fileTypes ?? meta.formats),
    dimensions: cleanString(item?.dimensions ?? meta.dimensions),
    materials: cleanArray(item?.materials ?? meta.materials),
    nsfwFlag: Boolean(meta.nsfwFlag),
    aiGeneratedFlag: Boolean(meta.aiGeneratedFlag),
    sourceLabel: cleanString(item?.sourceLabel),
    sourceIconUrl: cleanString(item?.sourceIconUrl),
    score: Number(item?.score ?? 0),
    meta,
  };
}
