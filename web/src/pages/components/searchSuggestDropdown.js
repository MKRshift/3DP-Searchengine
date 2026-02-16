import { esc } from "../../lib/format.js";

function renderGroupRows(items, groupKey, highlightedIndex) {
  return items
    .map((item, index) => {
      const active = index === highlightedIndex ? "is-active" : "";
      const thumb = item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="" loading="lazy" />` : "";
      return `
      <button type="button" class="suggest-item ${active}" data-suggest-group="${groupKey}" data-suggest-index="${index}">
        ${thumb}
        <span>
          <b>${esc(item.title)}</b>
          <small>${esc(item.type || "query")}${item.source ? ` • ${esc(item.source)}` : ""}</small>
        </span>
      </button>
    `;
    })
    .join("");
}

export function renderSuggestDropdown({ root, suggestions, visible, highlightedIndex = {} }) {
  const groups = {
    popular: Array.isArray(suggestions?.popular) ? suggestions.popular : [],
    recent: Array.isArray(suggestions?.recent) ? suggestions.recent : [],
    items: Array.isArray(suggestions?.items) ? suggestions.items : [],
  };
  const hasItems = groups.popular.length || groups.recent.length || groups.items.length;

  if (!visible || !hasItems) {
    root.style.display = "none";
    root.innerHTML = "";
    return;
  }

  root.style.display = "block";
  const sectionConfig = [
    { key: "popular", title: "Popular" },
    { key: "recent", title: "Recent" },
    { key: "items", title: "Items" },
  ];
  const sections = sectionConfig
    .filter(({ key }) => groups[key].length)
    .map(({ key, title }) => {
      const rows = renderGroupRows(groups[key], key, highlightedIndex[key] ?? -1);
      return `<div class="suggest-group"><div class="suggest-group-title">${title}</div>${rows}</div>`;
    })
    .join("");

  root.innerHTML = sections;
}
