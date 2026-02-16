import { Tabs } from "../../components/primitives/Tabs.js";

const TAB_CONFIG = [
  { id: "models", label: "Models" },
  { id: "laser-cut", label: "Laser Cut" },
  { id: "users", label: "Users" },
  { id: "collections", label: "Collections" },
  { id: "posts", label: "Posts" },
];

export function renderTabs({ root, counts, activeTab, onTabChange }) {
  root.innerHTML = Tabs({
    items: TAB_CONFIG.map((tab) => ({ id: tab.id, label: tab.label, count: counts?.[tab.id] ?? 0 })),
    active: activeTab,
  });

  root.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => onTabChange(button.dataset.tab));
  });
}
