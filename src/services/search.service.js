import { cache } from "../lib/cache.js";
import { rankAndDedupe } from "../lib/rank.js";
import { safeNumber, parseCsv } from "../lib/validate.js";
import { buildLinkResults } from "../lib/server/buildLinkResults.js";
import { buildSearchUrl } from "../lib/server/buildSearchUrl.js";
import { enrichResult } from "../lib/server/enrichResult.js";

const recentQueries = [];
const queryResultIndex = new Map();

const TAB_TO_ASSET = {
  models: ["model3d"],
  laser: ["laser2d"],
  cnc: ["cnc"],
  scans: ["scan3d"],
  cad: ["cad"],
};

function rememberSearch(query, results) {
  if (!query) return;
  if (!recentQueries.includes(query)) recentQueries.unshift(query);
  if (recentQueries.length > 20) recentQueries.length = 20;

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
  const fromRecent = recentQueries
    .filter((item) => item.toLowerCase().includes(q))
    .slice(0, 5)
    .map((item) => ({ type: "query", title: item }));

  const exactResults = queryResultIndex.get((query ?? "").toString().trim()) ?? [];
  const fallbackResults = Array.from(queryResultIndex.entries())
    .filter(([key]) => key.toLowerCase().includes(q))
    .flatMap(([, items]) => items)
    .slice(0, 5);

  return [...fromRecent, ...(exactResults.length ? exactResults : fallbackResults)].slice(0, 10);
}

function providerState(provider, errorMap) {
  if ((provider.mode ?? provider.kind ?? "api") === "link") return "link";
  if (errorMap.has(provider.id)) return "error";
  if (provider.isConfigured() || provider.isPublic) return "ok";
  return "warn";
}

function createLimiter(concurrency) {
  let active = 0;
  const queue = [];
  function runNext() {
    if (active >= concurrency || queue.length === 0) return;
    active += 1;
    const { task, resolve, reject } = queue.shift();
    task().then(resolve).catch(reject).finally(() => {
      active -= 1;
      runNext();
    });
  }
  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      runNext();
    });
}

function matchesTab(item, tab) {
  const allowed = TAB_TO_ASSET[tab] || TAB_TO_ASSET.models;
  return allowed.includes(item.assetType || "model3d");
}

function countByTabs(items) {
  return {
    models: items.filter((item) => matchesTab(item, "models")).length,
    laser: items.filter((item) => matchesTab(item, "laser")).length,
    cnc: items.filter((item) => matchesTab(item, "cnc")).length,
    scans: items.filter((item) => matchesTab(item, "scans")).length,
    cad: items.filter((item) => matchesTab(item, "cad")).length,
  };
}

export async function executeSearch({ query, providers }) {
  const t0 = Date.now();
  const q = (query.q ?? "").toString().trim();
  if (!q) return { status: 400, payload: { error: "Missing ?q= query" } };

  const limit = safeNumber(query.limit, 24, 1, 100);
  const page = safeNumber(query.page, 1, 1, 20);
  const sort = (query.sort ?? "relevant").toString().trim().toLowerCase();
  const tab = (query.tab ?? "models").toString().trim().toLowerCase();
  const sourcesParam = (query.sources ?? "").toString().trim();
  const requested = sourcesParam ? parseCsv(sourcesParam) : Object.keys(providers);

  const selectedProviders = requested.map((id) => providers[id]).filter(Boolean);

  const enabledLinkProviders = selectedProviders.filter((provider) => (provider.kind ?? "api") === "link");
  const enabledApiProviders = selectedProviders.filter((provider) => (provider.isConfigured() || provider.isPublic) && (provider.kind ?? "api") !== "link");

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

  const cacheKey = JSON.stringify({ q, limit, page, sort, tab, sources: enabledApiProviders.map((provider) => provider.id) });
  const cached = cache.get(cacheKey);
  if (cached) {
    return { status: 200, payload: { ...cached, quickLinks, cached: true, tookMs: Date.now() - t0 } };
  }

  const limiter = createLimiter(4);
  const results = [];
  const errors = [];

  await Promise.all(
    enabledApiProviders.map((provider) =>
      limiter(async () => {
        try {
          const providerResults = await provider.search({ q, limit, page, sort, tab });
          for (const item of providerResults) results.push(enrichResult(item, providers));
        } catch (error) {
          errors.push({ source: provider.id, message: error?.message ?? String(error) });
        }
      })
    )
  );

  const finalResults = rankAndDedupe(results, sort).filter((item) => matchesTab(item, tab)).slice(0, limit);
  const linkResults = buildLinkResults({ quickLinks, query: q }).filter((item) => matchesTab(item, tab));

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
    page,
    limit,
    sort,
    tab,
    sources: enabledApiProviders.map((provider) => provider.id),
    links: enabledLinkProviders.map((provider) => provider.id),
    count: finalResults.length,
    results: finalResults,
    linkResults,
    quickLinks,
    errors,
    providerStatus,
    tabCounts: countByTabs([...rankAndDedupe(results, sort), ...buildLinkResults({ quickLinks, query: q })]),
    cached: false,
    tookMs: Date.now() - t0,
  };

  cache.set(cacheKey, payload);
  return { status: 200, payload };
}
