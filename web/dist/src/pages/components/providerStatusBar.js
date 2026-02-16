import { IconBadge } from "../../components/primitives/IconBadge.js";
import { esc } from "../../lib/format.js";

export function renderProviderStatus(root, items = []) {
  if (!items.length) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = items
    .map((item) => {
      const icon = item.state === "ok" ? "✓" : item.state === "link" ? "🔗" : "⚠";
      return IconBadge({ label: esc(item.source), icon });
    })
    .join("<span> | </span>");
}
