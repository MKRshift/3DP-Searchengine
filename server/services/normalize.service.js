function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  const text = (value ?? "").toString().trim();
  return text || null;
}

function isValidUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
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

export class AdapterValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdapterValidationError";
  }
}

export function normalizeResult(item) {
  const data = isObject(item) ? item : {};
  const meta = isObject(data.meta) ? data.meta : {};
  const candidate = {
    id: cleanString(data.id) ?? `${data.source ?? "unknown"}:${cleanString(data.url) ?? cleanString(data.title) ?? "item"}`,
    source: cleanString(data.source) ?? "unknown",
    title: cleanString(data.title) ?? "Untitled",
    url: cleanString(data.url),
    thumbnail: cleanString(data.thumbnail),
    creatorName: cleanString(data.creatorName ?? data.author),
    creatorUrl: cleanString(data.creatorUrl ?? meta.creatorUrl),
    stats: {
      likes: cleanNumber(meta.likes),
      downloads: cleanNumber(meta.downloads ?? meta.download_count ?? meta.collects),
      views: cleanNumber(meta.views ?? meta.visits),
    },
    assetType: normalizeAssetType(data.assetType ?? meta.assetType),
    license: cleanString(meta.license ?? meta.store_license),
    price: cleanNumber(meta.price),
    currency: cleanString(meta.currency),
    tags: cleanArray(meta.tags),
    updatedAt: cleanDate(meta.updatedAt),
    publishedAt: cleanDate(meta.publishedAt ?? meta.createdAt),
    formats: cleanArray(meta.formats),
    fileTypes: cleanArray(data.fileTypes ?? meta.fileTypes ?? meta.formats),
    dimensions: cleanString(data.dimensions ?? meta.dimensions),
    materials: cleanArray(data.materials ?? meta.materials),
    nsfwFlag: Boolean(meta.nsfwFlag),
    aiGeneratedFlag: Boolean(meta.aiGeneratedFlag),
    sourceLabel: cleanString(data.sourceLabel),
    sourceIconUrl: cleanString(data.sourceIconUrl),
    score: Number(data.score ?? 0),
    meta,
  };
  if (!candidate.id || !candidate.source || !candidate.title) {
    throw new AdapterValidationError("Missing required fields");
  }
  if (!candidate.url || !isValidUrl(candidate.url)) {
    throw new AdapterValidationError("Invalid URL");
  }
  return candidate;
}

export function normalizeAdapterPayload(payload) {
  if (!Array.isArray(payload)) {
    throw new AdapterValidationError("Adapter payload must be an array of results");
    }
  return payload;
}
