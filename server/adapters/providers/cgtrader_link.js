import { makeLinkProvider } from "./_link_provider.js";

export function cgtraderLinkProvider() {
  return makeLinkProvider({
    id: "cgtrader_web",
    label: "CGTrader (web)",
    homepage: "https://www.cgtrader.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=cgtrader.com&sz=64",
    // CGTrader also has SEO pages /3d-models/<keyword>; this query form works
    // for multi-word searches.
    searchUrlTemplate: "https://www.cgtrader.com/3d-models?keywords={q}",
    notes: "🔗 Link-only (web search deep-link).",
  });
}
