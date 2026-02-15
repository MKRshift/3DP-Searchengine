import { makeLinkProvider } from "./_link_provider.js";

export function vectricLinkProvider() {
  return makeLinkProvider({
    id: "vectric",
    label: "Vectric",
    homepage: "https://www.vectric.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=vectric.com&sz=64",
    searchUrlTemplate: "https://www.vectric.com/vectric-community/free-projects/?query={q}",
    notes: "🔗 CNC/laser free project library (link-first).",
    assetTypes: ["cnc", "laser2d"],
  });
}
