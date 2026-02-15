import { fetchJson } from "../lib/http.js";

function pickThumb(it) {
  const candidates = [
    it?.previewImage,
    it?.preview_image,
    it?.thumbnail,
    it?.thumb,
    it?.images?.[0]?.url,
    it?.images?.[0],
  ].filter(Boolean);
  return candidates[0] ?? null;
}

export function cgtraderProvider() {
  const bearer = process.env.CGTRADER_BEARER_TOKEN?.trim();

  return {
    id: "cgtrader",
    label: "CGTrader",
    kind: "api",
    homepage: "https://www.cgtrader.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=cgtrader.com&sz=64",
    searchUrlTemplate: "https://www.cgtrader.com/3d-models?keywords={q}",
    isPublic: false,
    notes: bearer ? "bearer token set ✅" : "needs CGTRADER_BEARER_TOKEN ⚠️",
    isConfigured() {
      return Boolean(bearer);
    },
    async search({ q, limit, page }) {
      if (!bearer) throw new Error("CGTRADER_BEARER_TOKEN not set");

      const url = new URL("https://api.cgtrader.com/v1/models");
      url.searchParams.set("keywords", q); // per CGTrader docs
      url.searchParams.set("page", String(page));
      // CGTrader docs don't clearly specify per_page in the snippet; keep it simple.
      // If you want, add url.searchParams.set("per_page", String(limit))

      const headers = { Authorization: `Bearer ${bearer}` };
      const data = await fetchJson(url.toString(), { headers });

      const items =
        Array.isArray(data) ? data :
        Array.isArray(data?.items) ? data.items :
        Array.isArray(data?.models) ? data.models :
        [];

      return items.slice(0, limit).map((it) => {
        const id = it?.id ?? it?.uid ?? "";
        const title = it?.title ?? it?.name ?? "Untitled";
        const urlPublic = it?.url ?? it?.public_url ?? it?.link ?? null;
        const author = it?.author?.username ?? it?.user?.username ?? it?.seller?.username ?? "";

        const rating = Number(it?.rating ?? it?.avg_rating ?? 0);
        const price = it?.price ?? it?.formatted_price ?? null;

        return {
          source: "cgtrader",
          id: String(id),
          title,
          url: urlPublic,
          thumbnail: pickThumb(it),
          author,
          meta: { rating, price },
          score: rating * 10,
        };
      });
    },
  };
}
