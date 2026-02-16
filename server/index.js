import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

import { getProviders } from "./adapters/providers/index.js";
import { executeSearch, getSuggestions, getItemDetails, getProviderMetrics } from "./services/search.service.js";
import { handleApiRoute, handleProviderAdminRoute } from "./routes/api.js";

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
const webDistDir = path.join(rootDir, "web", "dist");
const webDevDir = path.join(rootDir, "web");
const staticDir = fs.existsSync(path.join(webDistDir, "index.html")) ? webDistDir : webDevDir;

loadEnvFile(path.join(rootDir, ".env"));
const providers = getProviders();

function reqId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function logEvent(event, details = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...details }));
}

const searchRateMap = new Map();
function rateLimitSearch(req) {
  const ip = req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60_000;
  const max = 80;
  const state = searchRateMap.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > state.resetAt) {
    state.count = 0;
    state.resetAt = now + windowMs;
  }
  state.count += 1;
  searchRateMap.set(ip, state);
  return state.count <= max;
}

const server = http.createServer(async (req, res) => {
  const requestId = req.headers["x-request-id"] || reqId();
  const started = Date.now();
  res.setHeader("x-request-id", requestId);
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  res.on("finish", () => {
    logEvent("request", { requestId, method: req.method, path: url.pathname, status: res.statusCode, ms: Date.now() - started });
  });

  if (await handleApiRoute({ req, res, url, providers, rateLimitSearch, executeSearch, getProviderMetrics, getItemDetails, getSuggestions })) return;
  if (handleProviderAdminRoute({ url, res, providers, getProviderMetrics })) return;

  if (url.pathname === "/" || /^\/search(\/(models|laser-cut|users|collections|posts|laser))?$/.test(url.pathname)) {
    sendFile(res, path.join(staticDir, "index.html"));
    return;
  }

  const sanitized = path.normalize(url.pathname).replace(/^\.+/, "");
  const staticPath = path.join(staticDir, sanitized);
  if (staticPath.startsWith(staticDir)) {
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
