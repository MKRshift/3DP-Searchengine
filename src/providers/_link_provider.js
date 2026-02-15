export function makeLinkProvider({
  id,
  label,
  homepage,
  searchUrlTemplate,
  iconUrl,
  notes,
  assetTypes = ["model3d"],
}) {
  return {
    id,
    label,
    kind: "link",
    mode: "link",
    homepage,
    searchUrlTemplate,
    iconUrl: iconUrl ?? null,
    isPublic: true,
    assetTypes,
    supports: {
      search: true,
      stats: false,
      license: false,
      formats: false,
    },
    notes: notes || "Link-only (no public search API).",
    isConfigured: () => true,
    search: async () => [],
  };
}
