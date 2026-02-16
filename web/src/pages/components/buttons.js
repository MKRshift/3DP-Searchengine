export function setButtonLoading(button, loading) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "Searching…" : "Search";
}
