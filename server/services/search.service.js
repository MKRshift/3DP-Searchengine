import pLimit from "p-limit";

import { cache } from "./cache.service.js";
import { rankAndDedupe } from "../lib/rank.js";
import { safeNumber, parseCsv } from "../lib/validate.js";
import { parseAdvancedQuery } from "../lib/query.js";
import { buildLinkResults } from "../lib/server/buildLinkResults.js";
import { buildSearchUrl } from "../lib/server/buildSearchUrl.js";
import { enrichResult } from "../lib/server/enrichResult.js";
import { AdapterValidationError, normalizeAdapterPayload } from "./normalize.service.js";
import synonyms from "../lib/config/synonyms.json" with { type: "json" };

const recentQueries = [];
const queryResultIndex = new Map();
const itemIndex = new Map();
const providerCircuit = new Map();
const providerMetrics = new Map();

function metricState(id) {
  if (!providerMetrics.has(id)) providerMetrics.set(id, { latencies: [], total: 0, errors: 0 });
  return providerMetrics.get(id);
}

function recordLatency(id, ms, ok) {
  const m = metricState(id);
  m.total += 1;
  if (!ok) m.errors += 1;
  m.latencies.push(ms);
  if (m.latencies.length > 300) m.latencies.shift();
}

function percentile(list, p) {
  if (!list.length) return 0;
  const sorted = [...list].sort((a,b)=>a-b);
  const idx = Math.min(sorted.length - 1, Math.floor((p/100) * (sorted.length - 1)));
  return Math.round(sorted[idx]);
}

export function getProviderMetrics() {
  return Array.from(providerMetrics.entries()).map(([id, m]) => ({
    id,
    total: m.total,
    errors: m.errors,
    errorRate: m.total ? Number((m.errors / m.total).toFixed(3)) : 0,
    p50: percentile(m.latencies, 50),
    p95: percentile(m.latencies, 95),
  }));
}

const TAB_TO_ASSET = {
  models: ["model3d", "cnc", "scan3d", "cad"],
  "laser-cut": ["laser2d"],
  users: ["user"],
  collections: ["collection"],
  posts: ["post"],
};

function rememberSearch(query, results) {
  if (!query) return;
  if (!recentQueries.includes(query)) recentQueries.unshift(query);
  if (recentQueries.length > 20) recentQueries.length = 20;

  for (const item of results) {
    if (item?.source && item?.id) itemIndex.set(`${item.source}:${item.id}`, item);
  }

  queryResultIndex.set(
    query,
    results.slice(0, 8).map((item) => ({
      type: item.assetType || "model",
      title: item.title,
      thumbnail: item.thumbnail,
      source: item.sourceLabel || item.source,
    }))
  );
}

export function getSuggestions(query) {
  const q = (query ?? "").toString().trim().toLowerCase();
  const recent = recentQueries
    .filter((item) => item.toLowerCase().includes(q))
    .slice(0, 5)
    .map((item) => ({ type: "query", title: item }));

  const exactResults = queryResultIndex.get((query ?? "").toString().trim()) ?? [];
  const fallbackItems = Array.from(queryResultIndex.entries())
    .filter(([key]) => key.toLowerCase().includes(q))
    .flatMap(([, items]) => items)
    .slice(0, 5);
  const items = exactResults.length ? exactResults : fallbackItems;
  const popular = items.slice(0, 3);

  return {
    popular,
    recent,
    items,
  };
}

export function getItemDetails({ source, id }) {
  if (!source || !id) return null;
  return itemIndex.get(`${source}:${id}`) ?? null;
}

function parseIntent(rawQuery) {
  const q = (rawQuery ?? "").toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);

  const formats = ["stl", "3mf", "svg", "dxf", "step", "obj"].filter((fmt) => tokens.includes(fmt));
  const licenseHint = tokens.find((x) => x === "cc-by" || x === "commercial") ?? null;
  const freeOnly = tokens.includes("free");

  const expanded = new Set(tokens);
  for (const token of tokens) {
    const mapped = synonyms[token];
    if (Array.isArray(mapped)) {
      for (const alias of mapped) expanded.add(alias.toLowerCase());
    }
  }

  return {
    expandedQuery: Array.from(expanded).join(" "),
    tokens: Array.from(expanded),
    formats,
    licenseHint,
    freeOnly,
  };
}


function normalizeEntityType(item) {
  const candidates = [
    item?.entityType,
    item?.meta?.entityType,
    item?.meta?.resultType,
    item?.meta?.kind,
    item?.meta?.type,
  ]
    .map((value) => (value ?? "").toString().trim().toLowerCase())
    .filter(Boolean);

  const value = candidates[0] || "";
  if (["user", "users", "profile", "creator"].includes(value)) return "user";
  if (["collection", "collections", "board", "list"].includes(value)) return "collection";
  if (["post", "posts", "article", "topic", "thread"].includes(value)) return "post";
  return "asset";
}

function normalizeTimeWindow(timeRange) {
  const value = (timeRange ?? "").toString().trim().toLowerCase();
  if (!value) return null;
  const match = value.match(/^(\d+)d$/);
  if (!match) return null;
  const days = Number.parseInt(match[1], 10);
  if (!Number.isFinite(days) || days <= 0) return null;
  return days * 86_400_000;
}

function providerState(provider, errorMap) {
  if ((provider.mode ?? provider.kind ?? "api") === "link") return "link";
  if (errorMap.has(provider.id)) return "error";
  if (provider.isConfigured() || provider.isPublic) return "ok";
  return "warn";
}

function matchesTab(item, tab) {
  if (tab === "users") return normalizeEntityType(item) === "user";
  if (tab === "collections") return normalizeEntityType(item) === "collection";
  if (tab === "posts") return normalizeEntityType(item) === "post";
  const allowed = TAB_TO_ASSET[tab] || TAB_TO_ASSET.models;
  return allowed.includes(item.assetType || "model3d");
}

function applyBoost(item, intent) {
  const title = (item.title ?? "").toLowerCase();
  let boost = 0;
  if (intent.tokens.some((token) => title.includes(token))) boost += 4;
  if (intent.formats.length && intent.formats.some((fmt) => (item.formats || []).map((x) => x.toLowerCase()).includes(fmt))) boost += 5;
  if (intent.licenseHint && (item.license || "").toLowerCase().includes(intent.licenseHint)) boost += 3;
  if (intent.freeOnly) {
    const price = Number(item.price);
    if (Number.isFinite(price) && price === 0) boost += 3;
  }
  return { ...item, score: Number(item.score || 0) + boost };
}

function applyFacetFilters(items, query) {
  const license = (query.license ?? "").toString().trim().toLowerCase();
  const format = (query.format ?? "").toString().trim().toLowerCase();
  const price = (query.price ?? "").toString().trim().toLowerCase();
  const timeWindowMs = normalizeTimeWindow(query.timeRange);

  return items.filter((item) => {
    if (license && !(item.license || "").toLowerCase().includes(license)) return false;
    if (format && !((item.formats || []).map((x) => x.toLowerCase()).includes(format))) return false;
    if (price === "free") {
      const p = Number(item.price);
      if (!(Number.isFinite(p) && p === 0)) return false;
    }
    if (price === "paid") {
      const p = Number(item.price);
      if (!(Number.isFinite(p) && p > 0)) return false;
    }
    if (timeWindowMs !== null) {
      const stamp = Date.parse(item.publishedAt || item.updatedAt || "");
      if (!Number.isFinite(stamp)) return false;
      if (Date.now() - stamp > timeWindowMs) return false;
    }
    return true;
  });
}

function buildFacets(items) {
  const facets = {
    sources: {},
    licenses: {},
    formats: {},
    price: { free: 0, paid: 0, unknown: 0 },
    timeRange: { "7d": 0, "30d": 0, "365d": 0, older: 0, unknown: 0 },
  };

  for (const item of items) {
    const source = item.sourceLabel || item.source || "unknown";
    facets.sources[source] = (facets.sources[source] || 0) + 1;

    const license = item.license || "unknown";
    facets.licenses[license] = (facets.licenses[license] || 0) + 1;

    for (const fmt of item.formats || []) {
      facets.formats[fmt] = (facets.formats[fmt] || 0) + 1;
    }

    const p = Number(item.price);
    if (Number.isFinite(p) && p === 0) facets.price.free += 1;
    else if (Number.isFinite(p) && p > 0) facets.price.paid += 1;
    else facets.price.unknown += 1;

    const t = Date.parse(item.publishedAt || item.updatedAt || "");
    if (!Number.isFinite(t)) facets.timeRange.unknown += 1;
    else if (Date.now() - t <= 7 * 86_400_000) {
      facets.timeRange["7d"] += 1;
      facets.timeRange["30d"] += 1;
      facets.timeRange["365d"] += 1;
    } else if (Date.now() - t <= 30 * 86_400_000) {
      facets.timeRange["30d"] += 1;
      facets.timeRange["365d"] += 1;
    } else if (Date.now() - t <= 365 * 86_400_000) {
      facets.timeRange["365d"] += 1;
      facets.timeRange.older += 1;
    } else facets.timeRange.older += 1;
  }

  return facets;
}

function countByTabs(items) {
  return {
    models: items.filter((item) => matchesTab(item, "models")).length,
    "laser-cut": items.filter((item) => matchesTab(item, "laser-cut")).length,
    users: items.filter((item) => matchesTab(item, "users")).length,
    collections: items.filter((item) => matchesTab(item, "collections")).length,
    posts: items.filter((item) => matchesTab(item, "posts")).length,
  };
}

function shouldSkipProvider(providerId) {
  const state = providerCircuit.get(providerId);
  if (!state) return false;
  if (state.coolDownUntil && state.coolDownUntil > Date.now()) return true;
  return false;
}

function recordProviderOutcome(providerId, ok) {
  const state = providerCircuit.get(providerId) || { failures: 0, coolDownUntil: 0 };
  if (ok) {
    providerCircuit.set(providerId, { failures: 0, coolDownUntil: 0 });
    return;
  }

  const failures = state.failures + 1;
  const coolDownUntil = failures >= 5 ? Date.now() + 2 * 60_000 : 0;
  providerCircuit.set(providerId, { failures, coolDownUntil });
}

export async function executeSearch({ query, providers }) {
  const t0 = Date.now();
  const rawQ = (query.q ?? "").toString().trim();
  if (!rawQ) return { status: 400, payload: { error: "Missing ?q= query" } };

  const advanced = parseAdvancedQuery(rawQ);
  const q = advanced.queryText || rawQ;
  const intent = parseIntent(q);

  const limit = safeNumber(query.limit, 24, 1, 100);
  const page = safeNumber(query.page, 1, 1, 20);
  const sort = (query.sort ?? "relevant").toString().trim().toLowerCase();
  const tab = (advanced.parsed.type || query.tab || "models").toString().trim().toLowerCase();
  const normalizedTab = tab === "laser" ? "laser-cut" : tab;
  const sourcesParam = (query.sources ?? "").toString().trim();
  const requested = sourcesParam ? parseCsv(sourcesParam) : Object.keys(providers);
  const requestedWithQuery = [...requested, ...advanced.parsed.source];
  const requestedSet = new Set(requestedWithQuery.filter(Boolean));

  const selectedProviders = [...requestedSet].map((id) => providers[id]).filter(Boolean);
  const enabledLinkProviders = selectedProviders.filter((provider) => (provider.kind ?? "api") === "link");
  const enabledApiProviders = selectedProviders
    .filter((provider) => (provider.isConfigured() || provider.isPublic) && (provider.kind ?? "api") !== "link")
    .filter((provider) => !shouldSkipProvider(provider.id));

  const quickLinks = selectedProviders
    .filter((provider) => Boolean(provider.searchUrlTemplate))
    .map((provider) => ({
      source: provider.id,
      label: provider.label,
      iconUrl: provider.iconUrl ?? null,
      kind: provider.kind ?? "api",
      assetTypes: provider.assetTypes ?? ["model3d"],
      url: buildSearchUrl(provider.searchUrlTemplate, q),
    }));

  const effectiveFilters = {
    ...query,
    format: advanced.parsed.format || query.format || "",
    license: advanced.parsed.license || query.license || "",
    price: advanced.parsed.price || query.price || "",
  };

  const cacheKey = JSON.stringify({ q, limit, page, sort, tab: normalizedTab, intent, chips: advanced.chips, sources: enabledApiProviders.map((provider) => provider.id), filters: effectiveFilters });
  const cached = cache.get(cacheKey);
  if (cached) {
    return { status: 200, payload: { ...cached, quickLinks, cached: true, tookMs: Date.now() - t0 } };
  }

  const limiter = pLimit(4);
  const results = [];
  const errors = [];

  await Promise.all(
    enabledApiProviders.map((provider) =>
      limiter(async () => {
        try {
          const p0 = Date.now();
          const providerPayload = await provider.search({ q: intent.expandedQuery, limit, page, sort, tab: normalizedTab });
          const providerResults = normalizeAdapterPayload(providerPayload);
          for (const item of providerResults) {
            try {
              results.push(applyBoost(enrichResult(item, providers), intent));
            } catch (error) {
              if (error instanceof AdapterValidationError) {
                errors.push({ source: provider.id, message: error.message });
                continue;
              }
              throw error;
            }
          }
          recordProviderOutcome(provider.id, true);
          recordLatency(provider.id, Date.now() - p0, true);
        } catch (error) {
          errors.push({ source: provider.id, message: error?.message ?? String(error) });
          recordProviderOutcome(provider.id, false);
          recordLatency(provider.id, 0, false);
        }
      })
    )
  );

  const rankedAll = rankAndDedupe(results, sort);
  const facetedAll = applyFacetFilters(rankedAll, effectiveFilters);

  const finalResults = facetedAll.filter((item) => matchesTab(item, normalizedTab)).slice(0, limit);
  const linkResults = buildLinkResults({ quickLinks, query: q }).filter((item) => matchesTab(item, normalizedTab));

  const errorMap = new Map(errors.map((error) => [error.source, error]));
  const providerStatus = selectedProviders.map((provider) => ({
    source: provider.label,
    id: provider.id,
    mode: provider.mode ?? provider.kind ?? "api",
    state: providerState(provider, errorMap),
    supports: provider.supports ?? { search: true, stats: false, license: false, formats: false },
    assetTypes: provider.assetTypes ?? ["model3d"],
  }));

  const allResults = [...finalResults, ...linkResults];
  rememberSearch(q, allResults);

  const payload = {
    query: q,
    expandedQuery: intent.expandedQuery,
    intent,
    queryChips: advanced.chips,
    page,
    limit,
    sort,
    tab: normalizedTab,
    sources: enabledApiProviders.map((provider) => provider.id),
    links: enabledLinkProviders.map((provider) => provider.id),
    count: finalResults.length,
    results: finalResults,
    linkResults,
    quickLinks,
    facets: buildFacets([...facetedAll, ...linkResults]),
    errors,
    providerStatus,
    tabCounts: countByTabs([...rankedAll, ...buildLinkResults({ quickLinks, query: q })]),
    cached: false,
    tookMs: Date.now() - t0,
  };

  cache.set(cacheKey, payload);
  return { status: 200, payload };
}
