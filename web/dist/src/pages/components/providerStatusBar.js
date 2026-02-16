import { esc } from "../../lib/format.js";

export function renderProviderStatus(root, items = []) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    root.style.display = "none";
    root.innerHTML = "";
    return;
  }

  const ok = list.filter((item) => item.state === "ok").length;
  const link = list.filter((item) => item.state === "link").length;
  const warnItems = list.filter((item) => item.state !== "ok" && item.state !== "link");

  const parts = [`${ok} live`, `${link} link`];
  if (warnItems.length) {
    const sources = warnItems.slice(0, 3).map((item) => esc(item.source)).join(", ");
    parts.push(`${warnItems.length} issues${sources ? ` (${sources})` : ""}`);
  }

  root.style.display = "block";
  root.innerHTML = `<span class="provider-status__label">Sources</span><span class="provider-status__summary">${parts.join(" • ")}</span>`;
}
