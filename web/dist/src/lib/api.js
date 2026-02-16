function normalizeSuggestionGroups(payload) {
  const grouped = payload?.groupedSuggestions;
  if (grouped && (Array.isArray(grouped.popular) || Array.isArray(grouped.recent) || Array.isArray(grouped.items))) {
    return {
      popular: Array.isArray(grouped.popular) ? grouped.popular : [],
      recent: Array.isArray(grouped.recent) ? grouped.recent : [],
      items: Array.isArray(grouped.items) ? grouped.items : [],
    };
  }

  const legacy = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
  return {
    popular: [],
    recent: legacy.filter((item) => item?.type === "query"),
    items: legacy.filter((item) => item?.type !== "query"),
  };
}

const SEARCH_TIMEOUT_MS = 12_000;

function withRequestTimeout(signal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    },
  };
}

export async function fetchSources() {
  const response = await fetch("/api/sources");
  const data = await response.json();
  return Array.isArray(data.sources) ? data.sources : [];
}

export async function fetchSearch({ query, sort, tab = "models", selected, page = 1, filters = {}, signal }) {
  const url = new URL("/api/search", window.location.origin);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "24");
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", sort);
  url.searchParams.set("tab", tab);
  if (selected?.size) url.searchParams.set("sources", Array.from(selected).join(","));
  for (const [k, v] of Object.entries(filters)) {
    if (v) url.searchParams.set(k, v);
  }

  const request = withRequestTimeout(signal, SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: request.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `Search failed (${response.status})`);
    return data;
  } catch (error) {
    if (error?.name === "AbortError" && request.didTimeout()) {
      throw new Error("Search timed out. Try narrowing your sources or query.");
    }
    throw error;
  } finally {
    request.cleanup();
  }
}

export async function fetchSuggestions(query) {
  const url = new URL("/api/suggest", window.location.origin);
  url.searchParams.set("q", query);
  const response = await fetch(url.toString());
  const data = await response.json();
  return normalizeSuggestionGroups(data);
}

export async function fetchItem({ source, id }) {
  const url = new URL("/api/item", window.location.origin);
  url.searchParams.set("source", source);
  url.searchParams.set("id", id);
  const response = await fetch(url.toString());
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Item fetch failed");
  return data?.item || null;
}
