import { fetchJson } from "../lib/http.js";

let cachedTree = null;
let cachedAt = 0;

function classifyAssetType(pathname) {
  const lower = pathname.toLowerCase();
  if (lower.includes("laser") || lower.endsWith(".svg") || lower.endsWith(".dxf")) return "laser2d";
  if (lower.includes("cnc") || lower.endsWith(".nc") || lower.endsWith(".gcode")) return "cnc";
  if (lower.endsWith(".step") || lower.endsWith(".stp") || lower.endsWith(".iges") || lower.endsWith(".igs")) return "cad";
  return "scan3d";
}

function extension(pathname) {
  const i = pathname.lastIndexOf(".");
  return i >= 0 ? pathname.slice(i + 1).toLowerCase() : null;
}

async function getTree() {
  const now = Date.now();
  if (cachedTree && now - cachedAt < 10 * 60_000) return cachedTree;

  const data = await fetchJson("https://api.github.com/repos/nasa/NASA-3D-Resources/git/trees/master?recursive=1", {
    headers: { accept: "application/vnd.github+json" },
    timeoutMs: 20_000,
  });

  cachedTree = Array.isArray(data?.tree) ? data.tree : [];
  cachedAt = now;
  return cachedTree;
}

export function nasaProvider() {
  return {
    id: "nasa",
    label: "NASA 3D Resources",
    kind: "api",
    mode: "api",
    homepage: "https://science.nasa.gov/3d-resources",
    iconUrl: "https://www.google.com/s2/favicons?domain=nasa.gov&sz=64",
    searchUrlTemplate: "https://github.com/nasa/NASA-3D-Resources/search?q={q}",
    isPublic: true,
    assetTypes: ["scan3d", "model3d", "cad"],
    supports: { search: true, stats: false, license: true, formats: true },
    notes: "public GitHub-indexed NASA 3D resources ✅",
    isConfigured() {
      return true;
    },
    async search({ q, limit }) {
      const tree = await getTree();
      const query = (q ?? "").toLowerCase();
      const matches = tree.filter((item) => {
        if (item?.type !== "blob") return false;
        const p = (item?.path ?? "").toLowerCase();
        return p.includes(query) && /\.(stl|obj|glb|gltf|fbx|3mf|step|stp|iges|igs|svg|dxf)$/i.test(p);
      });

      return matches.slice(0, limit).map((item) => {
        const path = item.path;
        const name = path.split("/").pop() || path;
        return {
          source: "nasa",
          id: item.sha || path,
          title: name.replace(/\.[^.]+$/, "").replaceAll("_", " "),
          url: `https://github.com/nasa/NASA-3D-Resources/blob/master/${encodeURIComponent(path).replaceAll("%2F", "/")}`,
          thumbnail: null,
          creatorName: "NASA",
          assetType: classifyAssetType(path),
          meta: {
            license: "NASA media usage guidelines",
            formats: [extension(path)].filter(Boolean),
          },
          score: 1,
        };
      });
    },
  };
}
