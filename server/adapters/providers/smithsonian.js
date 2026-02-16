import { fetchJson } from "../../lib/http.js";

function pickThumbnail(item) {
  const online = item?.content?.descriptiveNonRepeating?.online_media?.media;
  if (!Array.isArray(online)) return null;
  return online[0]?.thumbnail || online[0]?.content || null;
}

export function smithsonianProvider() {
  return {
    id: "smithsonian",
    label: "Smithsonian 3D",
    kind: "api",
    mode: "api",
    homepage: "https://3d.si.edu",
    iconUrl: "https://www.google.com/s2/favicons?domain=si.edu&sz=64",
    searchUrlTemplate: "https://www.si.edu/search?edan_q={q}",
    isPublic: true,
    assetTypes: ["scan3d", "model3d"],
    supports: { search: true, stats: false, license: true, formats: true },
    notes: "Smithsonian Open Access public API (tokenless demo key)",
    isConfigured() {
      return true;
    },
    async search({ q, limit, page = 1 }) {
      if (page > 1) return [];

      const url = new URL("https://api.si.edu/openaccess/api/v1.0/search");
      url.searchParams.set("api_key", process.env.SMITHSONIAN_API_KEY?.trim() || "DEMO_KEY");
      url.searchParams.set("q", `${q} AND online_media_type:Images`);
      url.searchParams.set("rows", String(Math.min(limit, 12)));

      let data;
      try {
        data = await fetchJson(url.toString(), { timeoutMs: 20_000, retries: 0 });
      } catch (error) {
        if (/429|OVER_RATE_LIMIT/i.test(String(error?.message ?? ""))) return [];
        throw error;
      }

      const rows = Array.isArray(data?.response?.rows) ? data.response.rows : [];

      return rows.slice(0, limit).map((row) => ({
        source: "smithsonian",
        id: row?.id || row?.content?.descriptiveNonRepeating?.record_ID || "",
        title: row?.title || "Untitled",
        url: row?.content?.descriptiveNonRepeating?.record_link || null,
        thumbnail: pickThumbnail(row),
        creatorName: "Smithsonian",
        assetType: "scan3d",
        meta: {
          license: row?.content?.freetext?.rightsAndReproductionUsage?.[0]?.content || "Smithsonian Open Access",
          formats: ["obj", "stl"],
        },
        score: 1,
      }));
    },
  };
}
