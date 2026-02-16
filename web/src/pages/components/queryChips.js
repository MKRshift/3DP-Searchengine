import { esc } from "../../lib/format.js";
import { Chip } from "../../components/primitives/Chip.js";

export function renderQueryChips(root, chips, { onRemove } = {}) {
  const list = Array.isArray(chips) ? chips : [];
  if (!list.length) {
    root.style.display = "none";
    root.innerHTML = "";
    return;
  }

  root.style.display = "flex";
  root.innerHTML = list
    .map((chip, index) =>
      Chip({
        className: "query-chip",
        label: `<span>${esc(chip.key)}:${esc(chip.value)}</span><span aria-hidden=\"true\">×</span>`,
        attrs: `data-chip-index=\"${index}\"`,
      })
    )
    .join("");

  root.querySelectorAll("[data-chip-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.chipIndex);
      if (Number.isFinite(index) && onRemove) onRemove(index);
    });
  });
}
