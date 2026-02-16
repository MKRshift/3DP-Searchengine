import { esc } from "../../lib/format.js";

export function renderPreviewDrawer(root, item) {
  if (!item) {
    root.classList.remove("is-open");
    root.innerHTML = "";
    return;
  }

  const stats = item.stats || item.meta || {};
  root.classList.add("is-open");
  root.innerHTML = `
    <div class="drawer__backdrop" data-drawer-close="1"></div>
    <aside class="drawer__panel" role="dialog" aria-label="Item preview" aria-modal="true">
      <button class="drawer__close" data-drawer-close="1">✕</button>
      <div class="drawer__thumb" style="${item.thumbnail ? `background-image:url('${esc(item.thumbnail)}')` : ""}"></div>
      <h2>${esc(item.title || "Untitled")}</h2>
      <p class="drawer__meta">${esc(item.creatorName || "Unknown creator")} • ${esc(item.sourceLabel || item.source || "")}</p>
      <p class="drawer__meta">${esc(item.assetType || "model3d")} ${item.license ? `• ${esc(item.license)}` : ""}</p>
      <div class="drawer__stats">
        <span>❤️ ${esc(String(stats.likes ?? "—"))}</span>
        <span>⬇️ ${esc(String(stats.downloads ?? stats.download_count ?? stats.collects ?? "—"))}</span>
        <span>👁 ${esc(String(stats.views ?? stats.visits ?? "—"))}</span>
      </div>
      <div class="drawer__actions">
        <a class="button button--primary" href="${esc(item.url || "#")}" target="_blank" rel="noopener noreferrer">Open source</a>
      </div>
    </aside>
  `;
}
