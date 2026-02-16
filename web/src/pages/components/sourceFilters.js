import { esc } from "../../lib/format.js";
import { Chip } from "../../components/primitives/Chip.js";

function sourceHint(source) {
  if ((source.kind || "api") === "link") return { css: "link", label: "link" };
  if (source.configured || source.id === "sketchfab") return { css: "ok", label: "ready" };
  return { css: "warn", label: "key" };
}

export function renderSourceFilters({ root, sources, selected, onToggle }) {
  root.innerHTML = sources
    .map((source) => {
      const checked = selected.has(source.id) ? "checked" : "";
      const note = source.notes || ((source.kind || "api") === "link" ? "Link search" : source.configured ? "Configured" : "Requires API key");
      const hint = sourceHint(source);
      const icon = source.iconUrl
        ? `<img src="${esc(source.iconUrl)}" alt="" loading="lazy" />`
        : "<span style='width:20px;height:20px;border:1px solid rgba(0,0,0,.1);border-radius:6px;display:inline-block'></span>";

      return `
      <label class="source-row" title="${esc(note)}">
        <input type="checkbox" data-source-id="${esc(source.id)}" ${checked} />
        ${icon}
        <span><strong>${esc(source.label)}</strong><small>${esc(note)}</small></span>
        ${Chip({ className: `pill ${hint.css}`, label: esc(hint.label) })}
      </label>
    `;
    })
    .join("");

  root.querySelectorAll("input[type=checkbox]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      onToggle(event.target.dataset.sourceId, event.target.checked);
    });
  });
}
