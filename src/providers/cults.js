import { fetchJson } from "../lib/http.js";

function basicAuth(user, pass) {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

export function cultsProvider() {
  const user = process.env.CULTS_BASIC_USER?.trim();
  const pass = process.env.CULTS_BASIC_PASS?.trim();

  return {
    id: "cults",
    label: "Cults3D",
    kind: "api",
    homepage: "https://cults3d.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=cults3d.com&sz=64",
    searchUrlTemplate: "https://cults3d.com/en/search?q={q}",
    isPublic: false,
    notes: user && pass ? "basic auth set ✅ (query may need tweaking)" : "needs CULTS_BASIC_USER/PASS ⚠️",
    isConfigured() {
      return Boolean(user && pass);
    },
    async search({ q, limit }) {
      if (!user || !pass) throw new Error("CULTS_BASIC_USER/PASS not set");

      // Cults' docs show a simple creations(limit: N) query, and recommends using their explorer to discover fields.
      // We default to pulling a batch and filtering client-side by title.
      // For *real* search, open the Cults GraphQL Explorer and update this query to their search field.
      const batch = Math.max(limit, 50);
      const gql = process.env.CULTS_GRAPHQL_QUERY?.trim() || `
        query {
          creations(limit: ${batch}) {
            name
            url
            creator { nick }
          }
        }
      `.trim();

      const body = new URLSearchParams({ query: gql }).toString();

      const data = await fetchJson("https://cults3d.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: basicAuth(user, pass),
        },
        body,
      });

      const items = Array.isArray(data?.data?.creations) ? data.data.creations : [];
      const qLower = q.toLowerCase();

      return items
        .filter((it) => (it?.name ?? "").toLowerCase().includes(qLower))
        .slice(0, limit)
        .map((it, idx) => ({
          source: "cults",
          id: String(it?.id ?? idx),
          title: it?.name ?? "Untitled",
          url: it?.url ?? null,
          thumbnail: null,
          author: it?.creator?.nick ?? "",
          meta: {},
          score: 1,
        }));
    },
  };
}
