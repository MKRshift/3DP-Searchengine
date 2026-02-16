import { esc } from "../../lib/format.js";

export function Button({ label, className = "", attrs = "", type = "button" }) {
  return `<button type="${esc(type)}" class="${esc(className)}" ${attrs}>${esc(label)}</button>`;
}
