import { esc } from "../../lib/format.js";

export function renderErrors(root, errors = []) {
  if (!errors.length) {
    root.style.display = "none";
    root.innerHTML = "";
    return;
  }

  root.style.display = "block";
  root.className = "error-box";
  root.innerHTML = `
    <strong>Provider warnings</strong>
    <ul>${errors.map((error) => `<li><b>${esc(error.source)}</b>: ${esc(error.message)}</li>`).join("")}</ul>
  `;
}
