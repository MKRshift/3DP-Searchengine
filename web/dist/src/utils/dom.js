export function bindClickOutside({ trigger, panel, onClose }) {
  function handler(event) {
    const target = event.target;
    if (!target) return;
    if (trigger?.contains(target) || panel?.contains(target)) return;
    onClose();
  }
  document.addEventListener("pointerdown", handler);
  return () => document.removeEventListener("pointerdown", handler);
}

export function trapFocus(panel, event) {
  if (event.key !== "Tab") return;
  const focusable = panel.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
