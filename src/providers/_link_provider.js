// A tiny helper to make "link-only" providers.
// These providers don't hit any API; they exist so the UI can generate
// a "Search on <site>" card / quick-link for platforms without a public API.

export function makeLinkProvider({
  id,
  label,
  homepage,
  searchUrlTemplate,
  iconUrl,
  notes,
}) {
  return {
    id,
    label,
    kind: "link",
    homepage,
    searchUrlTemplate,
    iconUrl: iconUrl ?? null,
    isPublic: true,
    notes: notes || "Link-only (no public search API).",
    isConfigured: () => true,
    // Returning [] keeps results clean; UI renders quick links separately.
    search: async () => [],
  };
}
