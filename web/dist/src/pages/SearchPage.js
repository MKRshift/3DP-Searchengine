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
import { bindClickOutside, trapFocus } from "../utils/dom.js";

const THEME_KEY = "meta-search.theme";
const THEME_ORDER = ["system", "light", "dark"];
const DRAWER_MEMORY_KEY = "meta-search.drawer";
const TAB_LABELS = { models: "Models", "laser-cut": "Laser", users: "Users", collections: "Collections", posts: "Posts" };

const elements = {
  form: document.querySelector("#search-form"), query: document.querySelector("#search-query"), clear: document.querySelector("#search-clear"),
  themeToggle: document.querySelector("#theme-toggle"), topbar: document.querySelector(".topbar"), sort: document.querySelector("#search-sort"),
  sourceList: document.querySelector("#sources-list"), title: document.querySelector("#results-title"), status: document.querySelector("#results-status"),
  quickLinks: document.querySelector("#quick-links"), queryChips: document.querySelector("#query-chips"), facets: document.querySelector("#facet-filters"),
  timeframe: document.querySelector("#timeframe-select"), mobileFilters: document.querySelector("#mobile-filters-toggle"),
  layout: document.querySelector(".layout"), errors: document.querySelector("#errors"), grid: document.querySelector("#results-grid"),
  submit: document.querySelector("button[type='submit']"), tabs: document.querySelector("#search-tabs"), providerStatus: document.querySelector("#provider-status"),
  suggest: document.querySelector("#search-suggest"), sentinel: document.querySelector("#results-sentinel"), topButton: document.querySelector("#scroll-top"),
  densityButtons: document.querySelectorAll("[data-density]"), previewDrawer: document.querySelector("#preview-drawer"),
  filterDrawer: document.querySelector("#filters-drawer"), filterPanel: document.querySelector(".filter-drawer__panel"), railItems: document.querySelectorAll("#category-rail [data-tab]"),
  landingView: document.querySelector("#landing-view"), searchView: document.querySelector("#search-view"),
  landingQuery: document.querySelector("#landing-query"), landingStart: document.querySelector("#landing-start"),
};

const state = {
  sources: [], sourceIds: [], selected: new Set(), debounceTimer: null, suggestTimer: null,
  suggestItems: { popular: [], recent: [], items: [] }, highlightedSuggest: { popular: -1, recent: -1, items: -1 },
  page: 1, loadingMore: false, hasMore: true, activeTab: "models",
  tabCounts: { models: 0, "laser-cut": 0, users: 0, collections: 0, posts: 0 }, filters: { license: "", format: "", price: "", timeRange: "" }, chips: [],
  openGroups: new Set(), lastFocus: null,
  autoFillPasses: 0,
  lastPageCount: 0,
  searchSeq: 0,
  searchController: null,
};

const emptySuggestionGroups = () => ({ popular: [], recent: [], items: [] });

function applyTheme(theme) {
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
  else if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  elements.themeToggle.textContent = `Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`;
}

function syncUrl() {
  setUrlState({ keyword: elements.query.value.trim(), sort: elements.sort.value, tab: state.activeTab, selected: state.selected, ids: state.sourceIds, filters: state.filters });
}

function setFilterDrawer(open) {
  elements.filterDrawer.classList.toggle("is-open", open);
  elements.filterDrawer.setAttribute("aria-hidden", String(!open));
  elements.mobileFilters.setAttribute("aria-expanded", String(open));
  if (open) {
    state.lastFocus = document.activeElement;
    setTimeout(() => elements.filterPanel.querySelector("button, input, select")?.focus(), 0);
  } else {
    state.lastFocus?.focus?.();
  }
}

function rememberDrawerState() {
  localStorage.setItem(DRAWER_MEMORY_KEY, JSON.stringify({ tab: state.activeTab, openGroups: [...state.openGroups], selected: [...state.selected] }));
}

function restoreDrawerState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAWER_MEMORY_KEY) || "{}");
    if (parsed.tab === state.activeTab && Array.isArray(parsed.openGroups)) state.openGroups = new Set(parsed.openGroups);
  } catch {}
}

function updateSourceFilters() {
  renderSourceFilters({
    root: elements.sourceList,
    sources: state.sources,
    selected: state.selected,
    openGroups: state.openGroups,
    onGroupToggle: (group, isOpen) => {
      if (isOpen) state.openGroups.add(group);
      else state.openGroups.delete(group);
      rememberDrawerState();
    },
    onToggle: (id, enabled, meta = {}) => {
      if (meta.refreshOnly) {
        syncUrl();
        if (elements.query.value.trim()) runSearch(elements.query.value.trim(), { reset: true, pushUrl: false });
        rememberDrawerState();
        return;
      }
      if (enabled) state.selected.add(id);
      else state.selected.delete(id);
      if (!meta.silent) {
        syncUrl();
        if (elements.query.value.trim()) runSearch(elements.query.value.trim(), { reset: true, pushUrl: false });
      }
      rememberDrawerState();
    },
  });
}

function renderFacets(facets) {
  if (!facets) { elements.facets.style.display = "none"; elements.facets.innerHTML = ""; return; }
  const fmtEntries = Object.entries(facets.formats || {}).slice(0, 6);
  const licenseEntries = Object.entries(facets.licenses || {}).slice(0, 6);
  const chip = (kind, value, count) => `<button class="facet-chip ${state.filters[kind] === value ? "is-active" : ""}" data-facet-kind="${kind}" data-facet-value="${value}" ${count <= 0 ? "disabled" : ""}>${value} (${count})</button>`;
  elements.facets.style.display = "flex";
  elements.facets.innerHTML = `<div>${fmtEntries.map(([k, v]) => chip("format", k, v)).join("")}</div><div>${licenseEntries.map(([k, v]) => chip("license", k, v)).join("")}</div>`;
  elements.facets.querySelectorAll("[data-facet-kind]").forEach((button) => button.addEventListener("click", () => {
    const kind = button.dataset.facetKind;
    const value = button.dataset.facetValue;
    state.filters[kind] = state.filters[kind] === value ? "" : value;
    syncUrl();
    runSearch(elements.query.value.trim(), { reset: true, pushUrl: false });
  }));
}

function updateTabs() {
  renderTabs({
    root: elements.tabs,
    counts: state.tabCounts,
    activeTab: state.activeTab,
    onTabChange: (tab) => {
      state.activeTab = tab;
      state.openGroups.clear();
      setFilterDrawer(false);
      syncUrl();
      runSearch(elements.query.value.trim(), { reset: true, pushUrl: false });
      updateRailActive();
    },
  });
}

function updateRailActive() {
  elements.railItems.forEach((item) => item.classList.toggle("is-active", item.dataset.tab === state.activeTab));
}

function setSearchViewMode(mode) {
  const searching = mode === "search";
  elements.landingView.style.display = searching ? "none" : "block";
  elements.searchView.style.display = searching ? "block" : "none";
}

function triggerSearchFromInput(raw) {
  const query = (raw || "").trim();
  if (!query) return;
  setSearchViewMode("search");
  elements.query.value = query;
  elements.clear.style.display = "inline-block";
  runSearch(query, { reset: true });
}

async function runSearch(query, { reset = true, pushUrl = true } = {}) {
  const normalizedQuery = (query || "").trim();
  if (!normalizedQuery) return;
  const seq = ++state.searchSeq;
  const pageForRequest = state.page;
  if (state.searchController && !state.searchController.signal.aborted) state.searchController.abort();
  const controller = new AbortController();
  state.searchController = controller;

  setSearchViewMode("search");
  if (pushUrl) syncUrl();
  if (reset) {
    state.page = 1;
    state.hasMore = true;
    state.loadingMore = false;
    state.autoFillPasses = 0;
    renderSkeleton(elements.grid);
  }

  setButtonLoading(elements.submit, true);
  renderErrors(elements.errors, []);
  elements.status.textContent = reset ? "Searching…" : "Loading more…";

  try {
    const data = await fetchSearch({
      query: normalizedQuery,
      sort: elements.sort.value,
      tab: state.activeTab,
      selected: state.selected,
      page: state.page,
      filters: state.filters,
      signal: controller.signal,
    });
    if (seq !== state.searchSeq) return;
    state.tabCounts = data.tabCounts || state.tabCounts;
    state.chips = data.queryChips || [];
    updateTabs();
    renderQueryChips(elements.queryChips, state.chips, { onRemove: () => null });
    renderFacets(data.facets);

    const results = [...(data.results || []), ...(data.linkResults || [])];
    renderResultGrid(elements.grid, results, { append: !reset });
    state.lastPageCount = Array.isArray(data.results) ? data.results.length : 0;
    const serverHasMore = data.hasMore;
    const defaultHasMore = state.lastPageCount > 0;
    state.hasMore = serverHasMore === undefined ? defaultHasMore : Boolean(serverHasMore);

    renderQuickLinks(elements.quickLinks, data.quickLinks || []);
    renderErrors(elements.errors, data.errors || []);
    renderProviderStatus(elements.providerStatus, data.providerStatus || []);

    elements.title.textContent = `${TAB_LABELS[state.activeTab] || "Results"} (${state.tabCounts[state.activeTab] || 0})`;
    elements.status.textContent = `${Array.isArray(data.results) ? data.results.length : 0}${state.hasMore ? "+" : ""} cards`;
    const prev = elements.grid.querySelector("#grid-load-more");
    if (prev) prev.remove();
    if (state.hasMore) {
      const btn = document.createElement("button");
      btn.id = "grid-load-more";
      btn.type = "button";
      btn.className = "button";
      btn.textContent = "Load more";
      btn.style.gridColumn = "1 / -1";
      btn.addEventListener("click", () => {
        if (state.loadingMore) return;
        state.loadingMore = true;
        state.page += 1;
        runSearch(elements.query.value.trim(), { reset: false, pushUrl: false });
      });
      elements.grid.appendChild(btn);
    }

    if (state.hasMore && state.autoFillPasses < 4 && document.body.scrollHeight <= window.innerHeight + 200) {
      state.autoFillPasses += 1;
      state.loadingMore = true;
      state.page += 1;
      await runSearch(normalizedQuery, { reset: false, pushUrl: false });
    }
  } catch (error) {
    if (seq !== state.searchSeq) return;
    if (error?.name === "AbortError") return;
    if (!reset && state.page === pageForRequest) state.page = Math.max(1, pageForRequest - 1);
    elements.status.textContent = `⚠️ ${error.message}`;
    if (reset) renderResultGrid(elements.grid, []);
  } finally {
    if (seq !== state.searchSeq) return;
    if (state.searchController === controller) state.searchController = null;
    state.loadingMore = false;
    setButtonLoading(elements.submit, false);
  }
}

async function loadSuggestions() {
  const query = elements.query.value.trim();
  if (query.length < 2) {
    state.suggestItems = emptySuggestionGroups();
    renderSuggestDropdown({ root: elements.suggest, suggestions: state.suggestItems, visible: false });
    return;
  }

  state.suggestItems = await fetchSuggestions(query);
  state.highlightedSuggest = { popular: -1, recent: -1, items: -1 };
  renderSuggestDropdown({ root: elements.suggest, suggestions: state.suggestItems, visible: true, highlightedIndex: state.highlightedSuggest });
  elements.suggest.querySelectorAll("[data-suggest-index]").forEach((item) => item.addEventListener("click", () => {
    const selected = state.suggestItems[item.dataset.suggestGroup]?.[Number(item.dataset.suggestIndex)];
    if (!selected) return;
    elements.query.value = selected.title;
    renderSuggestDropdown({ root: elements.suggest, suggestions: emptySuggestionGroups(), visible: false });
    runSearch(selected.title, { reset: true });
  }));
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
  if (initialState.mask !== null) {
    const mask = Number.parseInt(initialState.mask, 10);
    if (Number.isFinite(mask)) state.selected = applyMaskToSet(mask, state.sourceIds, new Set(state.sourceIds));
  }
  restoreDrawerState();
  updateSourceFilters();
  updateTabs();
  updateRailActive();
}

function bindEvents() {
  elements.form.addEventListener("submit", (event) => { event.preventDefault(); triggerSearchFromInput(elements.query.value); });
  elements.landingStart.addEventListener("click", () => triggerSearchFromInput(elements.landingQuery.value));
  elements.landingQuery.addEventListener("keydown", (event) => { if (event.key === "Enter") triggerSearchFromInput(elements.landingQuery.value); });
  elements.themeToggle.addEventListener("click", () => {
    const current = localStorage.getItem(THEME_KEY) || "system";
    const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  elements.railItems.forEach((item) => item.addEventListener("click", () => {
    const map = { cad: "models", cnc: "models", assets: "models", "laser-cut": "laser-cut", models: "models" };
    state.activeTab = map[item.dataset.tab] || "models";
    updateTabs();
    updateRailActive();
    setFilterDrawer(false);
    runSearch(elements.query.value.trim(), { reset: true });
  }));

  elements.mobileFilters.addEventListener("click", () => setFilterDrawer(!elements.filterDrawer.classList.contains("is-open")));
  elements.filterDrawer.addEventListener("click", (event) => { if (event.target.closest("[data-drawer-close]")) setFilterDrawer(false); });
  elements.filterPanel.addEventListener("keydown", (event) => trapFocus(elements.filterPanel, event));

  const unbindOutsideSuggest = bindClickOutside({ trigger: elements.query, panel: elements.suggest, onClose: () => renderSuggestDropdown({ root: elements.suggest, suggestions: emptySuggestionGroups(), visible: false }) });
  const unbindOutsideDrawer = bindClickOutside({ trigger: elements.mobileFilters, panel: elements.filterPanel, onClose: () => setFilterDrawer(false) });

  elements.query.addEventListener("focus", loadSuggestions);
  elements.query.addEventListener("blur", () => setTimeout(() => renderSuggestDropdown({ root: elements.suggest, suggestions: emptySuggestionGroups(), visible: false }), 130));
  elements.query.addEventListener("input", () => {
    clearTimeout(state.debounceTimer);
    clearTimeout(state.suggestTimer);
    elements.clear.style.display = elements.query.value.trim() ? "inline-block" : "none";
    state.debounceTimer = setTimeout(() => { if (elements.query.value.trim().length >= 2) runSearch(elements.query.value.trim(), { reset: true }); }, 250);
    state.suggestTimer = setTimeout(loadSuggestions, 120);
  });
  elements.query.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      renderSuggestDropdown({ root: elements.suggest, suggestions: emptySuggestionGroups(), visible: false });
      setFilterDrawer(false);
      renderPreviewDrawer(elements.previewDrawer, null);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { setFilterDrawer(false); renderPreviewDrawer(elements.previewDrawer, null); }
    if (event.key === "/" && document.activeElement !== elements.query) { event.preventDefault(); elements.query.focus(); }
  });

  elements.grid.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]");
    if (action?.dataset.action === "open") window.open(action.dataset.url, "_blank", "noopener,noreferrer");
    const card = event.target.closest("[data-preview-item]");
    if (!card) return;
    try {
      const parsed = JSON.parse(card.dataset.previewItem);
      const enriched = parsed?.source && parsed?.id ? await fetchItem({ source: parsed.source, id: parsed.id }).catch(() => parsed) : parsed;
      renderPreviewDrawer(elements.previewDrawer, enriched);
    } catch { renderPreviewDrawer(elements.previewDrawer, null); }
  });

  elements.previewDrawer.addEventListener("click", (event) => { if (event.target.closest("[data-drawer-close]")) renderPreviewDrawer(elements.previewDrawer, null); });
  elements.densityButtons.forEach((button) => button.addEventListener("click", () => {
    elements.grid.dataset.density = button.dataset.density;
    elements.densityButtons.forEach((x) => x.classList.toggle("is-active", x === button));
  }));

  elements.timeframe.addEventListener("change", () => {
    state.filters.timeRange = elements.timeframe.value;
    syncUrl();
    runSearch(elements.query.value.trim(), { reset: true, pushUrl: false });
  });

  elements.clear.addEventListener("click", () => {
    if (state.searchController && !state.searchController.signal.aborted) state.searchController.abort();
    state.searchSeq += 1;
    state.loadingMore = false;
    setButtonLoading(elements.submit, false);
    elements.status.textContent = "Ready.";
    elements.query.value = "";
    elements.clear.style.display = "none";
    renderSuggestDropdown({ root: elements.suggest, suggestions: emptySuggestionGroups(), visible: false });
    elements.query.focus();
  });

  window.addEventListener("scroll", () => {
    elements.topButton.style.display = window.scrollY > window.innerHeight * 1.5 ? "inline-flex" : "none";
    elements.topbar.classList.toggle("is-scrolled", window.scrollY > 4);
  });
  elements.topButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  // Infinite scroll across desktop (grid scroll container) and mobile (window scroll)
  function maybeLoadMoreForWindow() {
    if (state.loadingMore) return;
    if (!state.hasMore) return;
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
    if (nearBottom) {
      state.loadingMore = true;
      state.page += 1;
      runSearch(elements.query.value.trim(), { reset: false, pushUrl: false });
    }
  }
  function maybeLoadMoreForGrid() {
    if (state.loadingMore) return;
    if (!state.hasMore) return;
    const el = elements.grid;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
    if (nearBottom) {
      state.loadingMore = true;
      state.page += 1;
      runSearch(elements.query.value.trim(), { reset: false, pushUrl: false });
    }
  }
  elements.grid.addEventListener("scroll", maybeLoadMoreForGrid);
  window.addEventListener("scroll", maybeLoadMoreForWindow);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry.isIntersecting) return;
      if (state.loadingMore || !state.hasMore) return;
      state.loadingMore = true;
      state.page += 1;
      runSearch(elements.query.value.trim(), { reset: false, pushUrl: false });
    }, { root: null, rootMargin: "120px", threshold: 0 });
    io.observe(elements.sentinel);
    // Also observe the grid "load more" button when present
    const observeLoadMore = () => {
      const btn = elements.grid.querySelector("#grid-load-more");
      if (btn) io.observe(btn);
    };
    const mo = new MutationObserver(observeLoadMore);
    mo.observe(elements.grid, { childList: true });
    observeLoadMore();
  }

  window.addEventListener("beforeunload", () => { unbindOutsideSuggest(); unbindOutsideDrawer(); });
}

(async function boot() {
  const stored = localStorage.getItem(THEME_KEY) || "system";
  applyTheme(THEME_ORDER.includes(stored) ? stored : "system");
  await initSources();
  bindEvents();

  const initial = readUrlState();
  elements.sort.value = initial.sort || "relevant";
  elements.timeframe.value = initial.timeRange || "";

  const initialKeyword = (initial.keyword || "").trim();
  elements.query.value = initialKeyword;
  elements.landingQuery.value = initialKeyword;
  elements.clear.style.display = initialKeyword ? "inline-block" : "none";

  if (initialKeyword) {
    setSearchViewMode("search");
    syncUrl();
    runSearch(initialKeyword, { reset: true, pushUrl: false });
  } else {
    setSearchViewMode("landing");
  }
})();
