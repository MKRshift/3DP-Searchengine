import { esc } from "../utils/format.js";

export function renderProviderStatus(root, items = []) {
  if (!items.length) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = items
    .map((item) => {
      const icon = item.state === "ok" ? "✓" : item.state === "link" ? "🔗" : "⚠";
      return `<span>${esc(item.source)} ${icon}</span>`;
    })
    .join("<span> | </span>");
}
