# 3D Meta Search (Node.js)

A multi-platform 3D model meta-search with a MakerWorld-inspired UI and normalized rich cards.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000/search/models?keyword=hello

## Scripts

- `npm run dev` — start local server
- `npm run lint` — syntax checks for all modules
- `npm run test` — unit tests for normalized schema and search service
- `npm run deps:update` — update dependency versions in `package.json`

## Architecture

- Server entry: `src/server.js` (native Node HTTP server)
- Search orchestration: `src/services/search.service.js`
- Shared normalized schema: `src/lib/normalize.js`
- Frontend modules: `public/components`, `public/services`, `public/utils`, `public/styles`

## Provider docs

See:
- `docs/PROVIDER_CAPABILITY_MATRIX.md`
- `docs/DEPLOYMENT.md`
