import { makeLinkProvider } from "./_link_provider.js";

export function glowforgeLinkProvider() {
  return makeLinkProvider({
    id: "glowforge",
    label: "Glowforge",
    homepage: "https://glowforge.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=glowforge.com&sz=64",
    searchUrlTemplate: "https://glowforge.com/b/catalog?query={q}",
    notes: "🔗 Laser design catalog (link-first).",
    assetTypes: ["laser2d"],
  });
}
