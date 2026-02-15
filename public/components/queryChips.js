import { esc } from "../utils/format.js";

export function renderQueryChips(root, chips, { onRemove } = {}) {
  const list = Array.isArray(chips) ? chips : [];
  if (!list.length) {
    root.style.display = "none";
    root.innerHTML = "";
    return;
  }

  root.style.display = "flex";
  root.innerHTML = list
    .map(
      (chip, index) =>
        `<button class="query-chip" data-chip-index="${index}"><span>${esc(chip.key)}:${esc(chip.value)}</span><span aria-hidden="true">×</span></button>`
    )
    .join("");

  root.querySelectorAll("[data-chip-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.chipIndex);
      if (Number.isFinite(index) && onRemove) onRemove(index);
    });
  });
}
