import { esc } from "../../lib/format.js";

export function Input({ id, type = "text", className = "", placeholder = "", attrs = "" }) {
  return `<input id="${esc(id)}" type="${esc(type)}" class="${esc(className)}" placeholder="${esc(placeholder)}" ${attrs} />`;
}
