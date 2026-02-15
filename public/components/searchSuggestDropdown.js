import { esc } from "../utils/format.js";

export function renderSuggestDropdown({ root, suggestions, visible, highlightedIndex = -1 }) {
  if (!visible || !suggestions.length) {
    root.style.display = "none";
    root.innerHTML = "";
    return;
  }

  root.style.display = "block";
  const rows = suggestions.map((item, index) => {
    const active = index === highlightedIndex ? "is-active" : "";
    const thumb = item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="" loading="lazy" />` : "";
    return `
      <button type="button" class="suggest-item ${active}" data-suggest-index="${index}">
        ${thumb}
        <span>
          <b>${esc(item.title)}</b>
          <small>${esc(item.type || "query")}${item.source ? ` • ${esc(item.source)}` : ""}</small>
        </span>
      </button>
    `;
  }).join("");
  root.innerHTML = `<div class="suggest-group-title">Popular Search</div>${rows}`;
}
