import { makeLinkProvider } from "./_link_provider.js";

export function printablesLinkProvider() {
  return makeLinkProvider({
    id: "printables",
    label: "Printables",
    homepage: "https://www.printables.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=printables.com&sz=64",
    // Printables supports advanced operators; we just pass the raw query.
    searchUrlTemplate: "https://www.printables.com/search/models?q={q}",
    notes: "🔗 Link-only (no documented public API).",
  });
}
