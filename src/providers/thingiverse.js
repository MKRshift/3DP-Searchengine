import { fetchJson } from "../lib/http.js";

export function thingiverseProvider() {
  const token = process.env.THINGIVERSE_TOKEN?.trim();

  return {
    id: "thingiverse",
    label: "Thingiverse",
    kind: "api",
    homepage: "https://www.thingiverse.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=thingiverse.com&sz=64",
    searchUrlTemplate: "https://www.thingiverse.com/search?q={q}",
    isPublic: false,
    notes: token ? "token set ✅ (default uses /newest + filter)" : "needs THINGIVERSE_TOKEN ⚠️",
    isConfigured() {
      return Boolean(token);
    },
    async search({ q, limit, page }) {
      if (!token) throw new Error("THINGIVERSE_TOKEN not set");

      // Thingiverse has an official API (Swagger UI), but the docs are JS-heavy.
      // We use a safe default (/newest) demonstrated in Openverse's provider docs and filter locally by title.
      // If you find the official search endpoint in the Swagger UI, set THINGIVERSE_SEARCH_URL in .env
      // e.g. THINGIVERSE_SEARCH_URL=https://api.thingiverse.com/search/<whatever>
      const override = process.env.THINGIVERSE_SEARCH_URL?.trim();

      let url;
      if (override) {
        url = new URL(override);
        url.searchParams.set("access_token", token);
        // try a few common search param names; remove the ones you don't need
        if (!url.searchParams.has("q")) url.searchParams.set("q", q);
        if (!url.searchParams.has("term")) url.searchParams.set("term", q);
        if (!url.searchParams.has("query")) url.searchParams.set("query", q);
        if (!url.searchParams.has("page")) url.searchParams.set("page", String(page));
        if (!url.searchParams.has("per_page")) url.searchParams.set("per_page", String(Math.min(limit, 30)));
      } else {
        url = new URL("https://api.thingiverse.com/newest");
        url.searchParams.set("access_token", token);
        url.searchParams.set("per_page", String(Math.min(Math.max(limit, 30), 100)));
        url.searchParams.set("page", String(page));
      }

      const data = await fetchJson(url.toString());
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const qLower = q.toLowerCase();

      return items
        .filter((it) => (it?.name ?? "").toLowerCase().includes(qLower))
        .slice(0, limit)
        .map((it) => ({
          source: "thingiverse",
          id: String(it?.id ?? ""),
          title: it?.name ?? "Untitled",
          url: it?.public_url ?? it?.publicUrl ?? null,
          thumbnail: it?.thumbnail ?? it?.default_image?.sizes?.find?.((s) => s?.type === "preview" && s?.size === "card")?.url ?? null,
          author: it?.creator?.name ?? it?.creator?.username ?? "",
          meta: {
            likes: it?.like_count ?? null,
            collects: it?.collect_count ?? null,
          },
          score: Number(it?.like_count ?? 0) + Number(it?.collect_count ?? 0),
        }));
    },
  };
}
