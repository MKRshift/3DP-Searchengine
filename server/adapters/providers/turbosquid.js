import { makeLinkProvider } from "./_link_provider.js";

export function turbosquidLinkProvider() {
  return makeLinkProvider({
    id: "turbosquid",
    label: "TurboSquid",
    homepage: "https://www.turbosquid.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=turbosquid.com&sz=64",
    // TurboSquid uses a path-based search URL.
    searchUrlTemplate: "https://www.turbosquid.com/Search/3D-Models/{q}",
    notes: "🔗 Link-only (TurboSquid public API does not document a search endpoint).",
  });
}
