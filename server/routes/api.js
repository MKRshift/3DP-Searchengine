function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

export async function handleApiRoute({ req, res, url, providers, rateLimitSearch, executeSearch, getProviderMetrics, getItemDetails, getSuggestions }) {
  if (url.pathname === "/api/sources") {
    const sources = Object.values(providers).map((provider) => ({
      id: provider.id,
      label: provider.label,
      kind: provider.kind ?? "api",
      homepage: provider.homepage ?? null,
      searchUrlTemplate: provider.searchUrlTemplate ?? null,
      iconUrl: provider.iconUrl ?? null,
      configured: provider.isConfigured(),
      notes: provider.notes ?? "",
      mode: provider.mode ?? provider.kind ?? "api",
      assetTypes: provider.assetTypes ?? ["model3d"],
      supports: provider.supports ?? { search: true, stats: false, license: false, formats: false },
    }));
    json(res, 200, { sources });
    return true;
  }

  if (url.pathname === "/api/health/providers") {
    const health = Object.values(providers).map((provider) => ({
      id: provider.id,
      label: provider.label,
      mode: provider.mode ?? provider.kind ?? "api",
      configured: provider.isConfigured(),
      isPublic: Boolean(provider.isPublic),
      supports: provider.supports ?? { search: true, stats: false, license: false, formats: false },
    }));
    json(res, 200, { ok: true, providers: health, total: health.length });
    return true;
  }

  if (url.pathname === "/api/metrics/providers") {
    json(res, 200, { metrics: getProviderMetrics() });
    return true;
  }

  if (url.pathname === "/api/item") {
    const source = url.searchParams.get("source") || "";
    const id = url.searchParams.get("id") || "";
    const item = getItemDetails({ source, id });
    json(res, item ? 200 : 404, item ? { item } : { error: "Item not found in cache" });
    return true;
  }

  if (url.pathname === "/api/suggest") {
    const q = url.searchParams.get("q") || "";
    json(res, 200, { suggestions: getSuggestions(q) });
    return true;
  }

  if (url.pathname === "/api/search") {
    if (!rateLimitSearch(req)) {
      json(res, 429, { error: "Too many search requests. Please retry shortly." });
      return true;
    }
    const { status, payload } = await executeSearch({
      query: Object.fromEntries(url.searchParams.entries()),
      providers,
    });
    json(res, status, payload);
    return true;
  }

  return false;
}

export function handleProviderAdminRoute({ url, res, providers, getProviderMetrics }) {
  if (url.pathname !== "/admin/providers") return false;

  const providersList = Object.values(providers);
  const metricsMap = new Map(getProviderMetrics().map((item) => [item.id, item]));
  const rows = providersList
    .map((provider) => {
      const m = metricsMap.get(provider.id) || { total: 0, errorRate: 0, p50: 0, p95: 0 };
      return `<tr><td>${provider.label}</td><td>${provider.mode ?? provider.kind ?? "api"}</td><td>${provider.isConfigured() ? "yes" : "no"}</td><td>${m.total}</td><td>${m.p50}ms</td><td>${m.p95}ms</td><td>${Math.round(m.errorRate * 100)}%</td></tr>`;
    })
    .join("");
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html><head><title>Provider Metrics</title><style>body{font-family:Inter,Arial,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f6f8}</style></head><body><h1>Provider dashboard</h1><table><thead><tr><th>Provider</th><th>Mode</th><th>Configured</th><th>Requests</th><th>p50</th><th>p95</th><th>Error rate</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
  return true;
}
