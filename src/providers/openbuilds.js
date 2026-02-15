import { makeLinkProvider } from "./_link_provider.js";

export function openbuildsLinkProvider() {
  return makeLinkProvider({
    id: "openbuilds",
    label: "OpenBuilds",
    homepage: "https://builds.openbuilds.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=openbuilds.com&sz=64",
    searchUrlTemplate: "https://builds.openbuilds.com/projects/?search={q}",
    notes: "🔗 CNC projects (link-first).",
    assetTypes: ["cnc"],
  });
}
