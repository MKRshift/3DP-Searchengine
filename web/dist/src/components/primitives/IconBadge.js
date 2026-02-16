import { esc } from "../../lib/format.js";

export function IconBadge({ label, icon, className = "" }) {
  return `<span class="${esc(className)}">${esc(label)} ${esc(icon)}</span>`;
}
