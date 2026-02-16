export const MASK_ORDER = [
  "printables",
  "thangs",
  "makerworld",
  "thingiverse",
  "mmf",
  "cults",
  "sketchfab",
  "cgtrader",
  "turbosquid",
  "nasa",
  "smithsonian",
  "openbuilds",
  "vectric",
  "easel",
  "glowforge",
  "xtool",
];

const VALID_TABS = new Set(["models", "laser-cut", "users", "collections", "posts"]);

function normalizeTab(value) {
  const tab = (value ?? "").toString().trim().toLowerCase();
  if (tab === "laser") return "laser-cut";
  return VALID_TABS.has(tab) ? tab : "models";
}

function tabFromPath(pathname) {
  const m = pathname.match(/^\/search\/(models|laser-cut|users|collections|posts|laser)$/);
  return normalizeTab(m?.[1]);
}

export function readUrlState() {
  const url = new URL(window.location.href);
  return {
    keyword: url.searchParams.get("keyword") || url.searchParams.get("q") || "",
    sort: (url.searchParams.get("sort") || "relevant").toLowerCase(),
    tab: normalizeTab(url.searchParams.get("tab") || tabFromPath(url.pathname) || "models"),
    mask: url.searchParams.get("w"),
    sources: url.searchParams.get("sources"),
    license: url.searchParams.get("license") || "",
    format: url.searchParams.get("format") || "",
    price: url.searchParams.get("price") || "",
    timeRange: url.searchParams.get("timeRange") || "",
  };
}

export function selectedToMask(selected, ids) {
  let mask = 0;
  ids.forEach((id, index) => {
    if (selected.has(id)) mask |= 1 << index;
  });
  return mask >>> 0;
}

export function applyMaskToSet(mask, ids, fallback) {
  const selected = new Set();
  ids.forEach((id, index) => {
    if (mask & (1 << index)) selected.add(id);
  });
  return selected.size ? selected : fallback;
}

export function setUrlState({ keyword, sort, tab = "models", selected, ids, filters = {} }) {
  const url = new URL(window.location.href);
  const normalizedTab = normalizeTab(tab);
  url.pathname = `/search/${normalizedTab}`;
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("sort", sort);
  url.searchParams.set("tab", normalizedTab);
  url.searchParams.set("w", String(selectedToMask(selected, ids)));
  ["license", "format", "price", "timeRange"].forEach((key) => {
    const value = (filters[key] ?? "").toString().trim();
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  });
  window.history.replaceState({}, "", url);
}
