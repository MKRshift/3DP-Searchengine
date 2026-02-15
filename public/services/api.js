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
  if (selected.size) url.searchParams.set("sources", Array.from(selected).join(","));
  for (const [k, v] of Object.entries(filters)) {
    if (v) url.searchParams.set(k, v);
  }

  const response = await fetch(url.toString(), { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Search failed");
  return data;
}

export async function fetchSuggestions(query) {
  const url = new URL("/api/suggest", window.location.origin);
  url.searchParams.set("q", query);
  const response = await fetch(url.toString());
  const data = await response.json();
  return Array.isArray(data.suggestions) ? data.suggestions : [];
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
