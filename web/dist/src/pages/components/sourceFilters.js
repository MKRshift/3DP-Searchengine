import { esc } from "../../lib/format.js";
import { Chip } from "../../components/primitives/Chip.js";

function sourceHint(source) {
  if ((source.kind || "api") === "link") return { css: "link", label: "link" };
  if (source.configured || source.id === "sketchfab") return { css: "ok", label: "ready" };
  return { css: "warn", label: "key" };
}

function categoryForSource(source) {
  const types = Array.isArray(source.assetTypes) ? source.assetTypes : ["model3d"];
  if (types.includes("laser2d")) return "Laser";
  if (types.includes("cnc")) return "CNC";
  if (types.includes("cad")) return "CAD / Parts";
  if (types.includes("texture") || types.includes("mesh")) return "Assets";
  return "Models";
}

export function renderSourceFilters({ root, sources, selected, openGroups = new Set(), onToggle, onGroupToggle }) {
  const grouped = sources.reduce((map, source) => {
    const category = categoryForSource(source);
    if (!map.has(category)) map.set(category, []);
    map.get(category).push(source);
    return map;
  }, new Map());

  root.innerHTML = [...grouped.entries()]
    .map(([category, items]) => {
      const checkedCount = items.filter((source) => selected.has(source.id)).length;
      const isOpen = openGroups.has(category) ? "open" : "";
      const rows = items
        .map((source) => {
          const checked = selected.has(source.id) ? "checked" : "";
          const note = source.notes || ((source.kind || "api") === "link" ? "Link search" : source.configured ? "Configured" : "Requires API key");
          const hint = sourceHint(source);
          const icon = source.iconUrl
            ? `<img src="${esc(source.iconUrl)}" alt="" loading="lazy" />`
            : "<span style='width:20px;height:20px;border:1px solid rgba(0,0,0,.1);border-radius:6px;display:inline-block'></span>";

          return `<label class="source-row" title="${esc(note)}"><input type="checkbox" data-source-id="${esc(source.id)}" ${checked} />${icon}<span><strong>${esc(source.label)}</strong><small>${esc(note)}</small></span>${Chip({ className: `pill ${hint.css}`, label: esc(hint.label) })}</label>`;
        })
        .join("");

      return `<details ${isOpen} data-group="${esc(category)}"><summary>${esc(category)} (${checkedCount}/${items.length})</summary><div class="filter-actions"><button class="button" type="button" data-select-all="${esc(category)}">Select all</button><button class="button" type="button" data-clear-all="${esc(category)}">Clear</button></div>${rows}</details>`;
    })
    .join("");

  root.querySelectorAll("details[data-group]").forEach((item) => {
    item.addEventListener("toggle", () => onGroupToggle(item.dataset.group, item.open));
  });

  root.querySelectorAll("input[type=checkbox]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => onToggle(event.target.dataset.sourceId, event.target.checked));
  });

  root.querySelectorAll("[data-select-all]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.selectAll;
      const items = grouped.get(category) || [];
      items.forEach((source) => onToggle(source.id, true, { silent: true }));
      onToggle("", true, { refreshOnly: true });
    });
  });

  root.querySelectorAll("[data-clear-all]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.clearAll;
      const items = grouped.get(category) || [];
      items.forEach((source) => onToggle(source.id, false, { silent: true }));
      onToggle("", false, { refreshOnly: true });
    });
  });
}
