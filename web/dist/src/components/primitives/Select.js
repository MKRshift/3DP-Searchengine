import { esc } from "../../lib/format.js";

export function Select({ id, className = "", options = [] }) {
  const html = options.map((option) => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join("");
  return `<select id="${esc(id)}" class="${esc(className)}">${html}</select>`;
}
