import express from "express";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pLimit from "p-limit";

import { getProviders } from "./providers/index.js";
import { cache } from "./lib/cache.js";
import { safeNumber, parseCsv } from "./lib/validate.js";
import { rankAndDedupe } from "./lib/rank.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "250kb" }));

// basic abuse protection
app.use(
  "/api/",
  rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const providers = getProviders();

app.get("/api/sources", (req, res) => {
  const list = Object.values(providers).map((p) => ({
    id: p.id,
    label: p.label,
    kind: p.kind ?? "api",
    homepage: p.homepage ?? null,
    searchUrlTemplate: p.searchUrlTemplate ?? null,
    iconUrl: p.iconUrl ?? null,
    configured: p.isConfigured(),
    notes: p.notes ?? "",
  }));
  res.json({ sources: list });
});

function buildSearchUrl(tpl, q) {
  if (!tpl) return null;
  const safe = encodeURIComponent(q ?? "");
  return tpl.replaceAll("{q}", safe);
}

function enrich(item) {
  const p = providers[item.source];
  return {
    ...item,
    sourceLabel: p?.label ?? item.source,
    sourceIconUrl: p?.iconUrl ?? null,
  };
}

app.get("/api/search", async (req, res) => {
  const t0 = Date.now();
  const q = (req.query.q ?? "").toString().trim();
  if (!q) return res.status(400).json({ error: "Missing ?q= query" });

  const limit = safeNumber(req.query.limit, 30, 1, 100);
  const page = safeNumber(req.query.page, 1, 1, 20);
  const sort = (req.query.sort ?? "relevant").toString().trim().toLowerCase();
  const sourcesParam = (req.query.sources ?? "").toString().trim();
  const requested = sourcesParam ? parseCsv(sourcesParam) : Object.keys(providers);

  const enabledLinkProviders = requested
    .map((id) => providers[id])
    .filter(Boolean)
    .filter((p) => (p.kind ?? "api") === "link");

  const enabledApiProviders = requested
    .map((id) => providers[id])
    .filter(Boolean)
    .filter((p) => (p.isConfigured() || p.isPublic) && (p.kind ?? "api") !== "link");

  // Build quick links for *requested* sources that have templates (api + link)
  const quickLinks = requested
    .map((id) => providers[id])
    .filter(Boolean)
    .filter((p) => Boolean(p.searchUrlTemplate))
    .map((p) => ({
      source: p.id,
      label: p.label,
      iconUrl: p.iconUrl ?? null,
      kind: p.kind ?? "api",
      url: buildSearchUrl(p.searchUrlTemplate, q),
    }));

  const cacheKey = JSON.stringify({ q, limit, page, sort, sources: enabledApiProviders.map((p) => p.id) });
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, quickLinks, cached: true, tookMs: Date.now() - t0 });
  }

  const limiter = pLimit(4);
  const results = [];
  const errors = [];

  await Promise.all(
    enabledApiProviders.map((p) =>
      limiter(async () => {
        try {
          const r = await p.search({ q, limit, page, sort });
          for (const item of r) results.push(enrich(item));
        } catch (err) {
          errors.push({ source: p.id, message: err?.message ?? String(err) });
        }
      })
    )
  );

  const finalResults = rankAndDedupe(results, sort).slice(0, limit);

  const payload = {
    query: q,
    page,
    limit,
    sort,
    sources: enabledApiProviders.map((p) => p.id),
    links: enabledLinkProviders.map((p) => p.id),
    count: finalResults.length,
    results: finalResults,
    quickLinks,
    errors,
    cached: false,
    tookMs: Date.now() - t0,
  };

  cache.set(cacheKey, payload);
  res.json(payload);
});

// static frontend
app.use("/", express.static(path.join(__dirname, "..", "public"), { extensions: ["html"] }));

// MakerWorld-style URL support: /search/models?keyword=...
// We serve the same single-page UI for these routes.
app.get(["/search", "/search/models"], (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[3D Meta Search] http://localhost:${port}`);
});
