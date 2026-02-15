import { fetchSearch, fetchSources, fetchSuggestions } from "./services/api.js";
import { setButtonLoading } from "./components/buttons.js";
import { renderErrors } from "./components/errorPanel.js";
import { renderQuickLinks } from "./components/quickLinks.js";
import { renderResultGrid, renderSkeleton } from "./components/resultCard.js";
import { renderSourceFilters } from "./components/sourceFilters.js";
import { renderTabs } from "./components/searchTabs.js";
import { renderProviderStatus } from "./components/providerStatusBar.js";
import { renderSuggestDropdown } from "./components/searchSuggestDropdown.js";
import { renderPreviewDrawer } from "./components/previewDrawer.js";
import { applyMaskToSet, MASK_ORDER, readUrlState, setUrlState } from "./utils/urlState.js";

const SAVED_KEY = "meta-search.saved";

const elements = {
  form: document.querySelector("#search-form"),
  query: document.querySelector("#search-query"),
  sort: document.querySelector("#search-sort"),
  sourceList: document.querySelector("#sources-list"),
  title: document.querySelector("#results-title"),
  status: document.querySelector("#results-status"),
  quickLinks: document.querySelector("#quick-links"),
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
  suggestItems: [],
  highlightedSuggest: -1,
  page: 1,
  loadingMore: false,
  hasMore: true,
  activeTab: "models",
  tabCounts: { models: 0, laser: 0, cnc: 0, scans: 0, cad: 0 },
  currentPreview: null,
};

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

function syncUrl() {
  setUrlState({
    keyword: elements.query.value.trim(),
    sort: elements.sort.value,
    tab: state.activeTab,
    selected: state.selected,
    ids: state.sourceIds,
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
    },
  });
}

function filterByTab(items) {
  const map = { models: ["model3d"], laser: ["laser2d"], cnc: ["cnc"], scans: ["scan3d"], cad: ["cad"] };
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
      signal: state.requestController.signal,
    });

    state.tabCounts = data.tabCounts || { models: data.count || 0, laser: 0, cnc: 0, scans: 0, cad: 0 };
    updateTabs();

    const results = mergeResults(data, { append: !reset });
    state.hasMore = results.length >= 24;

    renderQuickLinks(elements.quickLinks, data.quickLinks || []);
    renderErrors(elements.errors, data.errors || []);
    renderProviderStatus(elements.providerStatus, data.providerStatus || []);

    const elapsed = Math.round(performance.now() - started);
    const sortCopy = elements.sort.options[elements.sort.selectedIndex]?.text || elements.sort.value;
    elements.title.textContent = `${state.activeTab[0].toUpperCase()}${state.activeTab.slice(1)} (${state.tabCounts[state.activeTab] || 0})`;
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
    state.suggestItems = [];
    renderSuggestDropdown({ root: elements.suggest, suggestions: [], visible: false });
    return;
  }

  state.suggestItems = await fetchSuggestions(query);
  state.highlightedSuggest = -1;
  renderSuggestDropdown({ root: elements.suggest, suggestions: state.suggestItems, visible: true, highlightedIndex: state.highlightedSuggest });

  elements.suggest.querySelectorAll("[data-suggest-index]").forEach((item) => {
    item.addEventListener("click", () => {
      const selected = state.suggestItems[Number(item.dataset.suggestIndex)];
      if (!selected) return;
      elements.query.value = selected.title;
      renderSuggestDropdown({ root: elements.suggest, suggestions: [], visible: false });
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
  if (initialState.sources) state.selected = new Set(initialState.sources.split(",").map((id) => id.trim()).filter(Boolean));
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

  elements.sort.addEventListener("change", () => {
    syncUrl();
    if (elements.query.value.trim()) runSearch(elements.query.value.trim(), { reset: true, pushUrl: false });
  });

  elements.query.addEventListener("focus", () => loadSuggestions());
  elements.query.addEventListener("input", () => {
    clearTimeout(state.debounceTimer);
    clearTimeout(state.suggestTimer);
    const query = elements.query.value.trim();

    state.debounceTimer = setTimeout(() => {
      if (query.length >= 2) runSearch(query, { reset: true });
    }, 250);

    state.suggestTimer = setTimeout(() => {
      loadSuggestions();
    }, 140);
  });

  elements.query.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      renderSuggestDropdown({ root: elements.suggest, suggestions: [], visible: false });
      renderPreviewDrawer(elements.previewDrawer, null);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.highlightedSuggest = Math.min(state.highlightedSuggest + 1, state.suggestItems.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      state.highlightedSuggest = Math.max(state.highlightedSuggest - 1, 0);
    } else if (event.key === "Enter" && state.highlightedSuggest >= 0) {
      event.preventDefault();
      const selected = state.suggestItems[state.highlightedSuggest];
      if (selected) {
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
    if (event.key === "Enter" && document.activeElement === elements.query && state.highlightedSuggest < 0) {
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
      state.currentPreview = parsed;
      renderPreviewDrawer(elements.previewDrawer, parsed);
    } catch {}
  });

  elements.previewDrawer.addEventListener("click", (event) => {
    if (event.target.closest("[data-drawer-close]")) {
      renderPreviewDrawer(elements.previewDrawer, null);
    }
  });

  elements.densityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      elements.grid.dataset.density = button.dataset.density;
      elements.densityButtons.forEach((x) => x.classList.toggle("is-active", x === button));
    });
  });

  window.addEventListener("scroll", () => {
    elements.topButton.style.display = window.scrollY > window.innerHeight * 1.5 ? "inline-flex" : "none";
    sessionStorage.setItem(`scroll:${window.location.pathname}${window.location.search}`, String(window.scrollY));
  });

  elements.topButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

(async function boot() {
  await initSources();
  bindEvents();
  setupInfiniteScroll();

  const initial = readUrlState();
  elements.sort.value = initial.sort || "relevant";
  elements.query.value = (initial.keyword || "hello").trim();
  syncUrl();

  const savedY = Number(sessionStorage.getItem(`scroll:${window.location.pathname}${window.location.search}`));
  if (Number.isFinite(savedY) && savedY > 0) window.scrollTo(0, savedY);

  runSearch(elements.query.value, { reset: true, pushUrl: false });
})();
