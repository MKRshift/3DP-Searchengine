import { fetchText } from "../../lib/http.js";

function parseItems(html, limit) {
  const items = [];
  const re = /href="(\/[a-z]{2}\/3d-model\/[^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) && items.length < limit) {
    const path = m[1];
    const slug = path.split("/").pop() || "cults result";
    items.push({
      source: "cults",
      id: path,
      title: decodeURIComponent(slug).replace(/-/g, " "),
      url: `https://cults3d.com${path}`,
      thumbnail: null,
      author: "",
      meta: {},
      score: 1,
    });
  }
  return items;
}

export function cultsProvider() {
  return {
    id: "cults",
    label: "Cults3D",
    kind: "api",
    homepage: "https://cults3d.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=cults3d.com&sz=64",
    searchUrlTemplate: "https://cults3d.com/en/search?q={q}",
    isPublic: true,
    notes: "Public search parser (tokenless)",
    isConfigured() {
      return true;
    },
    async search({ q, limit, page }) {
      const url = new URL("https://cults3d.com/en/search");
      url.searchParams.set("q", q);
      url.searchParams.set("page", String(page));
      const html = await fetchText(url.toString(), { timeoutMs: 15_000 });
      return parseItems(html, limit);
    },
  };
}
