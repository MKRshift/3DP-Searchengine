import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

import { getProviders } from "./providers/index.js";
import { executeSearch, getSuggestions } from "./services/search.service.js";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const raw = line.slice(idx + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^['"]|['"]$/g, "");
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  return "text/plain; charset=utf-8";
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");

loadEnvFile(path.join(rootDir, ".env"));
const providers = getProviders();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/sources") {
    const sources = Object.values(providers).map((provider) => ({
      id: provider.id,
      label: provider.label,
      kind: provider.kind ?? "api",
      homepage: provider.homepage ?? null,
      searchUrlTemplate: provider.searchUrlTemplate ?? null,
      iconUrl: provider.iconUrl ?? null,
      configured: provider.isConfigured(),
      notes: provider.notes ?? "",
      mode: provider.mode ?? provider.kind ?? "api",
      assetTypes: provider.assetTypes ?? ["model3d"],
      supports: provider.supports ?? { search: true, stats: false, license: false, formats: false },
    }));
    json(res, 200, { sources });
    return;
  }

  if (url.pathname === "/api/health/providers") {
    const health = Object.values(providers).map((provider) => ({
      id: provider.id,
      label: provider.label,
      mode: provider.mode ?? provider.kind ?? "api",
      configured: provider.isConfigured(),
      isPublic: Boolean(provider.isPublic),
      supports: provider.supports ?? { search: true, stats: false, license: false, formats: false },
    }));
    json(res, 200, { ok: true, providers: health, total: health.length });
    return;
  }

  if (url.pathname === "/api/suggest") {
    const q = url.searchParams.get("q") || "";
    json(res, 200, { suggestions: getSuggestions(q) });
    return;
  }

  if (url.pathname === "/api/search") {
    const { status, payload } = await executeSearch({
      query: Object.fromEntries(url.searchParams.entries()),
      providers,
    });
    json(res, status, payload);
    return;
  }

  if (url.pathname === "/" || /^\/search(\/(models|laser|cnc|scans|cad))?$/.test(url.pathname)) {
    sendFile(res, path.join(publicDir, "index.html"));
    return;
  }

  const sanitized = path.normalize(url.pathname).replace(/^\.+/, "");
  const staticPath = path.join(publicDir, sanitized);
  if (staticPath.startsWith(publicDir)) {
    sendFile(res, staticPath);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`[3D Meta Search] http://localhost:${port}`);
});
