import { makeLinkProvider } from "./_link_provider.js";

export function thangsLinkProvider() {
  return makeLinkProvider({
    id: "thangs",
    label: "Thangs",
    homepage: "https://thangs.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=thangs.com&sz=64",
    // We use tag pages as a robust best-effort deep-link.
    // Some deployments also support a direct /search/<query> URL, but that
    // isn't documented publicly.
    searchUrlTemplate: "https://thangs.com/tag/{q}/new-uploads",
    notes: "🔗 Link-only (best-effort tag deep-link).",
  });
}
