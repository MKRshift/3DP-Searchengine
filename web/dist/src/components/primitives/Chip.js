import { esc } from "../../lib/format.js";

export function Chip({ className = "", label, attrs = "" }) {
  return `<button class="${esc(className)}" ${attrs}>${label}</button>`;
}
