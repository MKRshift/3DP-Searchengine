import { makeLinkProvider } from "./_link_provider.js";

export function xtoolLinkProvider() {
  return makeLinkProvider({
    id: "xtool",
    label: "xTool",
    homepage: "https://www.xtool.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=xtool.com&sz=64",
    searchUrlTemplate: "https://www.xtool.com/pages/gallery?query={q}",
    notes: "🔗 Laser project gallery (link-first).",
    assetTypes: ["laser2d"],
  });
}
