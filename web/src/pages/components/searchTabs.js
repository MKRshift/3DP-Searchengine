import { Tabs } from "../../components/primitives/Tabs.js";

const TAB_ORDER = ["models", "laser", "cnc", "scans", "cad"];

export function renderTabs({ root, counts, activeTab, onTabChange }) {
  root.innerHTML = Tabs({
    items: TAB_ORDER.map((tab) => ({ id: tab, label: tab, count: counts?.[tab] ?? 0 })),
    active: activeTab,
  });

  root.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => onTabChange(button.dataset.tab));
  });
}
