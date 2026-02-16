import { fetchItem, fetchSearch, fetchSources, fetchSuggestions } from "../lib/api.js";
import { setButtonLoading } from "./components/buttons.js";
import { renderErrors } from "./components/errorPanel.js";
import { renderQuickLinks } from "./components/quickLinks.js";
import { renderResultGrid, renderSkeleton } from "./components/resultCard.js";
import { renderSourceFilters } from "./components/sourceFilters.js";
import { renderTabs } from "./components/searchTabs.js";
import { renderProviderStatus } from "./components/providerStatusBar.js";
import { renderSuggestDropdown } from "./components/searchSuggestDropdown.js";
import { renderPreviewDrawer } from "./components/previewDrawer.js";
import { renderQueryChips } from "./components/queryChips.js";
import { applyMaskToSet, MASK_ORDER, readUrlState, setUrlState } from "../lib/urlState.js";

const SAVED_KEY = "meta-search.saved";
const THEME_KEY = "meta-search.theme";
const THEME_ORDER = ["system", "light", "dark"];
const TAB_LABELS = {
  models: "Models",
  "laser-cut": "Laser Cut",
  users: "Users",
  collections: "Collections",
  posts: "Posts",
};

const elements = {
  form: document.querySelector("#search-form"),
  query: document.querySelector("#search-query"),
  clear: document.querySelector("#search-clear"),
  themeToggle: document.querySelector("#theme-toggle"),
  topbar: document.querySelector(".topbar"),
  sort: document.querySelector("#search-sort"),
  sourceList: document.querySelector("#sources-list"),
  title: document.querySelector("#results-title"),
  status: document.querySelector("#results-status"),
  quickLinks: document.querySelector("#quick-links"),
  queryChips: document.querySelector("#query-chips"),
  facets: document.querySelector("#facet-filters"),
  timeframe: document.querySelector("#timeframe-select"),
  mobileFilters: document.querySelector("#mobile-filters-toggle"),
  sidebarToggle: document.querySelector("#sidebar-toggle"),
  layout: document.querySelector(".layout"),
  sidebar: document.querySelector(".filters"),
  errors: document.querySelector("#errors"),
  grid: document.querySelector("#results-grid"),
  submit: document.querySelector("button[type='submit']"),
  tabs: document.querySelector("#search-tabs"),
  providerStatus: document.querySelector("#provider-status"),
  suggest: document.querySelector("#search-suggest"),
  sentinel: document.querySelector("#results-sentinel"),
  topButton: document.querySelector("#scroll-top"),
  densityButtons: document.querySelectorAll("[data-density]"),
  previewDrawer: document.querySelector("#preview-drawer"),
};

const state = {
  sources: [],
  sourceIds: [],
  selected: new Set(),
  requestController: null,
  debounceTimer: null,
  suggestTimer: null,
  suggestItems: { popular: [], recent: [], items: [] },
  highlightedSuggest: { popular: -1, recent: -1, items: -1 },
  page: 1,
  loadingMore: false,
  hasMore: true,
  activeTab: "models",
  tabCounts: { models: 0, "laser-cut": 0, users: 0, collections: 0, posts: 0 },
  filters: { license: "", format: "", price: "", timeRange: "" },
  chips: [],
};


function emptySuggestionGroups() {
  return { popular: [], recent: [], items: [] };
}

function flattenSuggestions(groups) {
  return [
    ...(groups?.popular || []).map((item, index) => ({ item, group: "popular", index })),
    ...(groups?.recent || []).map((item, index) => ({ item, group: "recent", index })),
    ...(groups?.items || []).map((item, index) => ({ item, group: "items", index })),
  ];
}

function suggestionAt(groups, pointer) {
  if (!pointer || !pointer.group || pointer.index < 0) return null;
  return groups?.[pointer.group]?.[pointer.index] || null;
}

function savedItems() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveItem(item) {
  const list = savedItems();
  if (list.some((entry) => entry.url === item.url)) return false;
  list.unshift({ ...item, savedAt: new Date().toISOString() });
  localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 200)));
  return true;
}


function applyTheme(theme) {
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
  else if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  if (elements.themeToggle) elements.themeToggle.textContent = `Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`;
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY) || "system";
  const theme = THEME_ORDER.includes(stored) ? stored : "system";
  applyTheme(theme);
}

function cycleTheme() {
  const current = localStorage.getItem(THEME_KEY) || "system";
  const idx = THEME_ORDER.indexOf(current);
  const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}


function setSidebarHidden(hidden) {
  if (!elements.layout) return;
  elements.layout.classList.toggle("is-sidebar-hidden", hidden);
  if (elements.sidebarToggle) {
    elements.sidebarToggle.setAttribute("aria-expanded", String(!hidden));
    elements.sidebarToggle.textContent = hidden ? "Show filters" : "Hide filters";
  }
}

function setMobileFiltersOpen(open) {
  if (!elements.layout) return;
  elements.layout.classList.toggle("is-mobile-filters-open", open);
  if (elements.mobileFilters) {
    elements.mobileFilters.setAttribute("aria-expanded", String(open));
  }
}

function updateQueryClear() {
  if (!elements.clear) return;
  elements.clear.style.display = elements.query.value.trim() ? "inline-block" : "none";
}

function syncUrl() {
  setUrlState({
    keyword: elements.query.value.trim(),
    sort: elements.sort.value,
    tab: state.activeTab,
    selected: state.selected,
    ids: state.sourceIds,
    filters: state.filters,
  });
}


function removeQueryChip(index) {
  const chip = state.chips[index];
  if (!chip) return;
  const token = `${chip.key}:${chip.value}`;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "i");
  elements.query.value = elements.query.value.replace(pattern, " ").replace(/\s+/g, " ").trim();
  if (["format", "license", "price", "timeRange"].includes(chip.key)) {
    state.filters[chip.key] = "";
  }
  runSearch(elements.query.value.trim(), { reset: true });
}

function renderFacets(facets) {
  if (!facets) {
    elements.facets.style.display = "none";
    elements.facets.innerHTML = "";
    return;
  }

  const fmtEntries = Object.entries(facets.formats || {}).slice(0, 6);
  const licenseEntries = Object.entries(facets.licenses || {}).slice(0, 6);

  const chip = (kind, value, count) => {
    const active = state.filters[kind] === value ? "is-active" : "";
    const disabled = count <= 0 ? "disabled" : "";
    return `<button class="facet-chip ${active}" data-facet-kind="${kind}" data-facet-value="${value}" ${disabled}>${value} (${count})</button>`;
  };

  elements.facets.style.display = "flex";
  elements.facets.innerHTML = `
    <div class="facet-group"><span class="facet-label">Format</span>${fmtEntries.map(([k,v])=>chip("format",k,v)).join("")}</div>
    <div class="facet-group"><span class="facet-label">License</span>${licenseEntries.map(([k,v])=>chip("license",k,v)).join("")}</div>
    <div class="facet-group"><span class="facet-label">Price</span>${chip("price","free",facets.price?.free||0)}${chip("price","paid",facets.price?.paid||0)}</div>
    <div class="facet-group"><span class="facet-label">Time</span>${chip("timeRange","7d",facets.timeRange?.["7d"]||0)}${chip("timeRange","30d",facets.timeRange?.["30d"]||0)}${chip("timeRange","365d",facets.timeRange?.["365d"]||0)}</div>
  `;

  elements.facets.querySelectorAll("[data-facet-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.facetKind;
      const value = button.dataset.facetValue;
      state.filters[kind] = state.filters[kind] === value ? "" : value;
      if (kind === "timeRange" && elements.timeframe) elements.timeframe.value = state.filters.timeRange;
      syncUrl();
      runSearch(elements.query.value.trim(), { reset: true, pushUrl: false });
    });
  });
}

function updateTabs() {
  renderTabs({
    root: elements.tabs,
    counts: state.tabCounts,
    activeTab: state.activeTab,
    onTabChange: (tab) => {
      state.activeTab = tab;
      syncUrl();
      if (elements.query.value.trim()) runSearch(elements.query.value.trim(), { reset: true, pushUrl: false });
      setMobileFiltersOpen(false);
    },
  });
}

function updateSourceFilters() {
  renderSourceFilters({
    root: elements.sourceList,
    sources: state.sources,
    selected: state.selected,
    onToggle: (id, enabled) => {
      if (enabled) state.selected.add(id);
      else state.selected.delete(id);
      syncUrl();
      if (elements.query.value.trim()) runSearch(elements.query.value.trim(), { reset: true, pushUrl: false });
      setMobileFiltersOpen(false);
    },
  });
}

function classifyEntityType(item) {
  const value = [item?.entityType, item?.meta?.entityType, item?.meta?.resultType, item?.meta?.kind, item?.meta?.type]
    .map((entry) => (entry || "").toString().trim().toLowerCase())
    .find(Boolean);
  if (["user", "users", "profile", "creator"].includes(value)) return "user";
  if (["collection", "collections", "board", "list"].includes(value)) return "collection";
  if (["post", "posts", "article", "topic", "thread"].includes(value)) return "post";
  return "asset";
}

function filterByTab(items) {
  const map = {
    models: ["model3d", "cnc", "scan3d", "cad"],
    "laser-cut": ["laser2d"],
  };

  if (state.activeTab === "users") return items.filter((item) => classifyEntityType(item) === "user");
  if (state.activeTab === "collections") return items.filter((item) => classifyEntityType(item) === "collection");
  if (state.activeTab === "posts") return items.filter((item) => classifyEntityType(item) === "post");

  const allowed = map[state.activeTab] || map.models;
  return items.filter((item) => allowed.includes(item.assetType || "model3d"));
}

function mergeResults(data, { append }) {
  const apiResults = Array.isArray(data.results) ? data.results : [];
  const linkResults = Array.isArray(data.linkResults) ? data.linkResults : [];
  const combined = filterByTab([...apiResults, ...linkResults]);
  renderResultGrid(elements.grid, combined, { append });
  return combined;
}

async function runSearch(query, { reset = true, pushUrl = true } = {}) {
  if (!query) return;
  if (pushUrl) syncUrl();

  if (reset) {
    state.page = 1;
    state.hasMore = true;
    renderSkeleton(elements.grid);
  }

  if (state.requestController) state.requestController.abort();
  state.requestController = new AbortController();

  setButtonLoading(elements.submit, true);
  renderErrors(elements.errors, []);
  elements.status.textContent = reset ? "Searching…" : "Loading more…";

  const started = performance.now();
  try {
    const data = await fetchSearch({
      query,
      sort: elements.sort.value,
      tab: state.activeTab,
      selected: state.selected,
      page: state.page,
      filters: state.filters,
      signal: state.requestController.signal,
    });

    state.tabCounts = data.tabCounts || { models: data.count || 0, "laser-cut": 0, users: 0, collections: 0, posts: 0 };
    state.chips = data.queryChips || [];
    updateTabs();
    renderQueryChips(elements.queryChips, state.chips, { onRemove: removeQueryChip });
    renderFacets(data.facets);

    const results = mergeResults(data, { append: !reset });
    state.hasMore = results.length >= 24;

    renderQuickLinks(elements.quickLinks, data.quickLinks || []);
    renderErrors(elements.errors, data.errors || []);
    renderProviderStatus(elements.providerStatus, data.providerStatus || []);

    const elapsed = Math.round(performance.now() - started);
    const sortCopy = elements.sort.options[elements.sort.selectedIndex]?.text || elements.sort.value;
    elements.title.textContent = `${TAB_LABELS[state.activeTab] || "Models"} (${state.tabCounts[state.activeTab] || 0})`;
    elements.status.textContent = `${results.length} cards • sorted by ${sortCopy} • ${elapsed}ms`;
    document.title = `3D Meta Search — ${query}`;
  } catch (error) {
    if (error.name !== "AbortError") {
      elements.status.textContent = `⚠️ ${error.message}`;
      renderResultGrid(elements.grid, []);
    }
  } finally {
    state.loadingMore = false;
    setButtonLoading(elements.submit, false);
  }
}

async function loadSuggestions() {
  const query = elements.query.value.trim();
  if (query.length < 1) {
    state.suggestItems = emptySuggestionGroups();
    renderSuggestDropdown({ root: elements.suggest, suggestions: emptySuggestionGroups(), visible: false });
    return;
  }

  state.suggestItems = await fetchSuggestions(query);
  state.highlightedSuggest = { popular: -1, recent: -1, items: -1 };
  renderSuggestDropdown({ root: elements.suggest, suggestions: state.suggestItems, visible: true, highlightedIndex: state.highlightedSuggest });

  elements.suggest.querySelectorAll("[data-suggest-index]").forEach((item) => {
    item.addEventListener("click", () => {
      const group = item.dataset.suggestGroup;
      const index = Number(item.dataset.suggestIndex);
      const selected = state.suggestItems[group]?.[index];
      if (!selected) return;
      elements.query.value = selected.title;
      renderSuggestDropdown({ root: elements.suggest, suggestions: emptySuggestionGroups(), visible: false });
      runSearch(elements.query.value.trim(), { reset: true });
    });
  });
}

async function initSources() {
  const sources = await fetchSources();
  state.sources = [...sources].sort((a, b) => {
    const ids = [...MASK_ORDER, ...sources.map((source) => source.id)];
    return ids.indexOf(a.id) - ids.indexOf(b.id);
  });
  state.sourceIds = state.sources.map((source) => source.id);
  state.selected = new Set(state.sourceIds);

  const initialState = readUrlState();
  state.activeTab = initialState.tab || "models";
  state.filters.timeRange = initialState.timeRange || "";
  if (initialState.sources) state.selected = new Set(initialState.sources.split(",").map((id) => id.trim()).filter(Boolean));
  state.filters = {
    license: initialState.license || "",
    format: initialState.format || "",
    price: initialState.price || "",
    timeRange: initialState.timeRange || "",
  };
  if (elements.timeframe) elements.timeframe.value = state.filters.timeRange || "";

  if (initialState.mask !== null) {
    const mask = Number.parseInt(initialState.mask, 10);
    if (Number.isFinite(mask)) state.selected = applyMaskToSet(mask, state.sourceIds, new Set(state.sourceIds));
  }

  updateSourceFilters();
  updateTabs();
}

function setupInfiniteScroll() {
  const observer = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting || state.loadingMore || !state.hasMore) return;
    const query = elements.query.value.trim();
    if (!query) return;
    state.loadingMore = true;
    state.page += 1;
    runSearch(query, { reset: false, pushUrl: false });
  });
  observer.observe(elements.sentinel);
}

function bindEvents() {
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(elements.query.value.trim(), { reset: true });
  });


  if (elements.themeToggle) {
    elements.themeToggle.addEventListener("click", cycleTheme);
  }

  if (elements.clear) {
    elements.clear.addEventListener("click", () => {
      elements.query.value = "";
      updateQueryClear();
      renderSuggestDropdown({ root: elements.suggest, suggestions: emptySuggestionGroups(), visible: false });
      elements.query.focus();
    });
  }

  elements.sort.addEventListener("change", () => {
    syncUrl();
    if (elements.query.value.trim()) runSearch(elements.query.value.trim(), { reset: true, pushUrl: false });
  });

  if (elements.timeframe) {
    elements.timeframe.addEventListener("change", () => {
      state.filters.timeRange = elements.timeframe.value;
      syncUrl();
      if (elements.query.value.trim()) runSearch(elements.query.value.trim(), { reset: true, pushUrl: false });
    });
  }

  if (elements.mobileFilters) {
    elements.mobileFilters.addEventListener("click", () => {
      const open = !elements.layout.classList.contains("is-mobile-filters-open");
      setMobileFiltersOpen(open);
    });
  }

  if (elements.sidebarToggle) {
    elements.sidebarToggle.addEventListener("click", () => {
      const hidden = !elements.layout.classList.contains("is-sidebar-hidden");
      setSidebarHidden(hidden);
      setMobileFiltersOpen(false);
    });
  }

  elements.query.addEventListener("focus", () => loadSuggestions());
  elements.query.addEventListener("input", () => {
    clearTimeout(state.debounceTimer);
    clearTimeout(state.suggestTimer);
    const query = elements.query.value.trim();
    updateQueryClear();

    state.debounceTimer = setTimeout(() => {
      if (query.length >= 2) runSearch(query, { reset: true });
    }, 250);

    state.suggestTimer = setTimeout(() => {
      loadSuggestions();
    }, 140);
  });

  elements.query.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      renderSuggestDropdown({ root: elements.suggest, suggestions: emptySuggestionGroups(), visible: false });
      renderPreviewDrawer(elements.previewDrawer, null);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const flat = flattenSuggestions(state.suggestItems);
      const activeIdx = flat.findIndex((entry) => state.highlightedSuggest[entry.group] === entry.index);
      const next = Math.min(activeIdx + 1, flat.length - 1);
      state.highlightedSuggest = { popular: -1, recent: -1, items: -1 };
      if (flat[next]) state.highlightedSuggest[flat[next].group] = flat[next].index;
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const flat = flattenSuggestions(state.suggestItems);
      const activeIdx = flat.findIndex((entry) => state.highlightedSuggest[entry.group] === entry.index);
      const next = Math.max(activeIdx - 1, 0);
      state.highlightedSuggest = { popular: -1, recent: -1, items: -1 };
      if (flat[next]) state.highlightedSuggest[flat[next].group] = flat[next].index;
    } else if (event.key === "Enter") {
      const pointer = Object.entries(state.highlightedSuggest).find(([, idx]) => idx >= 0);
      const selected = suggestionAt(state.suggestItems, pointer ? { group: pointer[0], index: pointer[1] } : null);
      if (selected) {
        event.preventDefault();
        elements.query.value = selected.title;
        runSearch(selected.title, { reset: true });
      }
    }

    renderSuggestDropdown({ root: elements.suggest, suggestions: state.suggestItems, visible: true, highlightedIndex: state.highlightedSuggest });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== elements.query) {
      event.preventDefault();
      elements.query.focus();
    }
    if (event.key === "Escape") renderPreviewDrawer(elements.previewDrawer, null);
    if (event.key === "Enter" && document.activeElement === elements.query && Object.values(state.highlightedSuggest).every((idx) => idx < 0)) {
      const first = elements.grid.querySelector("a.card__link");
      if (first) first.click();
    }
  });

  elements.grid.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]");
    if (action) {
      event.preventDefault();
      const url = action.dataset.url;
      if (action.dataset.action === "open" && url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      if (action.dataset.action === "copy" && url) {
        await navigator.clipboard.writeText(url).catch(() => null);
        action.textContent = "Copied";
        setTimeout(() => {
          action.textContent = "Copy";
        }, 700);
        return;
      }
      if (action.dataset.action === "save" && url) {
        const saved = saveItem({ title: action.dataset.title, url, source: action.dataset.source });
        action.textContent = saved ? "Saved" : "Saved ✓";
      }
      return;
    }

    const card = event.target.closest("[data-preview-item]");
    if (!card) return;
    try {
      const parsed = JSON.parse(card.dataset.previewItem);
      if (parsed?.source && parsed?.id) {
        const enriched = await fetchItem({ source: parsed.source, id: parsed.id }).catch(() => parsed);
        renderPreviewDrawer(elements.previewDrawer, enriched || parsed);
      } else {
        renderPreviewDrawer(elements.previewDrawer, parsed);
      }
    } catch {
      renderPreviewDrawer(elements.previewDrawer, null);
    }
  });

  elements.previewDrawer.addEventListener("click", (event) => {
    if (event.target.closest("[data-drawer-close]")) renderPreviewDrawer(elements.previewDrawer, null);
  });

  elements.densityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      elements.grid.dataset.density = button.dataset.density;
      elements.densityButtons.forEach((x) => x.classList.toggle("is-active", x === button));
    });
  });

  window.addEventListener("scroll", () => {
    elements.topButton.style.display = window.scrollY > window.innerHeight * 1.5 ? "inline-flex" : "none";
    if (elements.topbar) elements.topbar.classList.toggle("is-scrolled", window.scrollY > 4);
    sessionStorage.setItem(`scroll:${window.location.pathname}${window.location.search}`, String(window.scrollY));
  });

  elements.topButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

(async function boot() {
  initTheme();
  await initSources();
  bindEvents();
  setupInfiniteScroll();

  const initial = readUrlState();
  elements.sort.value = initial.sort || "relevant";
  elements.query.value = (initial.keyword || "hello").trim();
  updateQueryClear();
  if (elements.timeframe) elements.timeframe.value = initial.timeRange || "";
  setSidebarHidden(false);
  setMobileFiltersOpen(false);
  syncUrl();

  const savedY = Number(sessionStorage.getItem(`scroll:${window.location.pathname}${window.location.search}`));
  if (Number.isFinite(savedY) && savedY > 0) window.scrollTo(0, savedY);

  runSearch(elements.query.value, { reset: true, pushUrl: false });
})();
