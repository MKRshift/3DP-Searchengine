import { esc } from "../utils/format.js";

export function renderQuickLinks(root, quickLinks = []) {
  if (!quickLinks.length) {
    root.style.display = "none";
    root.innerHTML = "";
    return;
  }

  root.style.display = "flex";
  root.innerHTML = quickLinks.map((link) => `
    <a href="${esc(link.url)}" target="_blank" rel="noreferrer">
      ${link.iconUrl ? `<img src="${esc(link.iconUrl)}" alt="" loading="lazy" />` : ""}
      <span>${esc(link.label || link.source)}</span>
    </a>
  `).join("");
}
