# 3D Meta Search (Node.js)

A tiny "meta-search engine" that queries multiple 3D model sites and renders results as cards.

✅ Works out-of-the-box with **Sketchfab** (public search).  
🔌 Add API keys/tokens to enable more sources (MyMiniFactory, CGTrader, Thingiverse, Cults).
🔗 Also includes **link-only** shortcuts for sites without a documented public search API (Printables, Thangs, MakerWorld, TurboSquid).

The UI is a **MakerWorld-inspired** card grid. Each card shows the source favicon in the top-left, plus quick-link chips to open the same query directly on each site.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000

## URLs

- MakerWorld-style: `/search/models?keyword=cyber`
- 3Drop-style bitmask for selected sites: `&w=23` (client encodes/decodes this automatically)

## Add sources

- **MyMiniFactory**: set `MMF_API_KEY` (sent as `key=` query param) and refresh.
- **CGTrader**: set `CGTRADER_BEARER_TOKEN`.
- **Thingiverse**: set `THINGIVERSE_TOKEN`.
- **Cults**: set `CULTS_BASIC_USER` + `CULTS_BASIC_PASS` and customize the GraphQL query in `src/providers/cults.js`.

## Link-only sources

These don't query an API. They show "quick link" cards that open the search results on each site:

- Printables
- Thangs (best-effort tag deep-link)
- MakerWorld
- TurboSquid

## Notes

- Respect each site's Terms of Service and rate limits.
- Providers are pluggable: add new ones under `src/providers/`.
