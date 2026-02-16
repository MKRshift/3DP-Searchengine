import { z } from "zod";

const nullableString = z.string().trim().min(1).nullable();
const nullableNumber = z.number().nonnegative().nullable();

const normalizedResultSchema = z.object({
  id: z.string().trim().min(1),
  source: z.string().trim().min(1),
  title: z.string().trim().min(1),
  url: nullableString,
  thumbnail: nullableString,
  creatorName: nullableString,
  creatorUrl: nullableString,
  stats: z.object({
    likes: nullableNumber,
    downloads: nullableNumber,
    views: nullableNumber,
  }),
  assetType: z.enum(["model3d", "laser2d", "cnc", "scan3d", "cad"]),
  license: nullableString,
  price: nullableNumber,
  currency: nullableString,
  tags: z.array(z.string()),
  updatedAt: nullableString,
  publishedAt: nullableString,
  formats: z.array(z.string()),
  fileTypes: z.array(z.string()),
  dimensions: nullableString,
  materials: z.array(z.string()),
  nsfwFlag: z.boolean(),
  aiGeneratedFlag: z.boolean(),
  sourceLabel: nullableString,
  sourceIconUrl: nullableString,
  score: z.number(),
  meta: z.record(z.string(), z.unknown()),
});

const adapterResultSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  source: z.string().optional(),
  title: z.union([z.string(), z.number()]).optional(),
  url: z.string().url().optional(),
  thumbnail: z.string().url().nullable().optional(),
  creatorName: z.union([z.string(), z.number()]).nullable().optional(),
  author: z.union([z.string(), z.number()]).nullable().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

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

export class AdapterValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdapterValidationError";
  }
}

export function normalizeResult(item) {
  const parsedItem = adapterResultSchema.safeParse(item);
  if (!parsedItem.success) {
    throw new AdapterValidationError(`Invalid adapter result: ${parsedItem.error.issues[0]?.message ?? "schema parse failed"}`);
  }

  const meta = parsedItem.data?.meta ?? {};
  const candidate = {
    id: cleanString(parsedItem.data?.id) ?? `${parsedItem.data?.source ?? "unknown"}:${cleanString(parsedItem.data?.url) ?? cleanString(parsedItem.data?.title) ?? "item"}`,
    source: cleanString(parsedItem.data?.source) ?? "unknown",
    title: cleanString(parsedItem.data?.title) ?? "Untitled",
    url: cleanString(parsedItem.data?.url),
    thumbnail: cleanString(parsedItem.data?.thumbnail),
    creatorName: cleanString(parsedItem.data?.creatorName ?? parsedItem.data?.author),
    creatorUrl: cleanString(parsedItem.data?.creatorUrl ?? meta.creatorUrl),
    stats: {
      likes: cleanNumber(meta.likes),
      downloads: cleanNumber(meta.downloads ?? meta.download_count ?? meta.collects),
      views: cleanNumber(meta.views ?? meta.visits),
    },
    assetType: normalizeAssetType(parsedItem.data?.assetType ?? meta.assetType),
    license: cleanString(meta.license ?? meta.store_license),
    price: cleanNumber(meta.price),
    currency: cleanString(meta.currency),
    tags: cleanArray(meta.tags),
    updatedAt: cleanDate(meta.updatedAt),
    publishedAt: cleanDate(meta.publishedAt ?? meta.createdAt),
    formats: cleanArray(meta.formats),
    fileTypes: cleanArray(parsedItem.data?.fileTypes ?? meta.fileTypes ?? meta.formats),
    dimensions: cleanString(parsedItem.data?.dimensions ?? meta.dimensions),
    materials: cleanArray(parsedItem.data?.materials ?? meta.materials),
    nsfwFlag: Boolean(meta.nsfwFlag),
    aiGeneratedFlag: Boolean(meta.aiGeneratedFlag),
    sourceLabel: cleanString(parsedItem.data?.sourceLabel),
    sourceIconUrl: cleanString(parsedItem.data?.sourceIconUrl),
    score: Number(parsedItem.data?.score ?? 0),
    meta,
  };

  const normalized = normalizedResultSchema.safeParse(candidate);
  if (!normalized.success) {
    throw new AdapterValidationError(`Invalid normalized result: ${normalized.error.issues[0]?.message ?? "schema parse failed"}`);
  }

  return normalized.data;
}

export function normalizeAdapterPayload(payload) {
  const parsed = z.array(z.unknown()).safeParse(payload);
  if (!parsed.success) {
    throw new AdapterValidationError("Adapter payload must be an array of results");
  }
  return parsed.data;
}
