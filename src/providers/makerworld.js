import { makeLinkProvider } from "./_link_provider.js";

export function makerworldLinkProvider() {
  return makeLinkProvider({
    id: "makerworld",
    label: "MakerWorld",
    homepage: "https://makerworld.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=makerworld.com&sz=64",
    searchUrlTemplate: "https://makerworld.com/en/search/models?keyword={q}",
    notes: "🔗 Link-only (search deep-link).",
  });
}
