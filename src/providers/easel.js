import { makeLinkProvider } from "./_link_provider.js";

export function easelLinkProvider() {
  return makeLinkProvider({
    id: "easel",
    label: "Easel",
    homepage: "https://easel.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=easel.com&sz=64",
    searchUrlTemplate: "https://easel.com/gallery/all?query={q}",
    notes: "🔗 CNC gallery (link-first).",
    assetTypes: ["cnc"],
  });
}
