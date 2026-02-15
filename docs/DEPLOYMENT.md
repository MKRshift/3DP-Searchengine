# Deployment Notes

## Runtime
- Node.js 20+
- `npm install`
- `npm run dev`

## Environment variables
- `PORT`
- `SKETCHFAB_TOKEN` (optional)
- `MMF_API_KEY`
- `THINGIVERSE_TOKEN`
- `CGTRADER_BEARER_TOKEN`
- `CULTS_BASIC_USER`
- `CULTS_BASIC_PASS`

## Caching and reliability
- In-memory TTL cache in `src/lib/cache.js`
- Provider retries + backoff + timeout in `src/lib/http.js`
- Service-level concurrency limiting in `src/services/search.service.js`

## Legal/ToS
- Use only provider-sanctioned APIs where available.
- Treat link-only sources as best-effort and avoid aggressive scraping.
