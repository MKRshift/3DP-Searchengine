import { esc } from "../utils/format.js";

const TAB_ORDER = ["models", "laser", "cnc", "scans", "cad"];

export function renderTabs({ root, counts, activeTab, onTabChange }) {
  root.innerHTML = TAB_ORDER.map((tab) => {
    const active = activeTab === tab ? "is-active" : "";
    const count = counts?.[tab] ?? 0;
    return `<button type="button" class="tab ${active}" data-tab="${tab}">${esc(tab)} <span>${count}</span></button>`;
  }).join("");

  root.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => onTabChange(button.dataset.tab));
  });
}
