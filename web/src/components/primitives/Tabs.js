import { esc } from "../../lib/format.js";

export function Tabs({ items = [], active }) {
  return items
    .map((item) => `<button type="button" class="tab ${active === item.id ? "is-active" : ""}" data-tab="${esc(item.id)}">${esc(item.label)} <span>${esc(String(item.count ?? 0))}</span></button>`)
    .join("");
}
