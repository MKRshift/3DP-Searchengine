# Provider Capability Matrix

| Provider | Mode | Auth | Asset types | Rich fields today | Notes |
|---|---|---|---|---|---|
| Sketchfab | api | optional token | model3d | thumbnail, creator, likes, views, publishedAt | strongest public model API |
| MyMiniFactory | api | `MMF_API_KEY` | model3d | thumbnail, creator, likes, visits | official API key flow |
| Thingiverse | api | `THINGIVERSE_TOKEN` | model3d | thumbnail, creator, likes, collects | newest+filter fallback |
| CGTrader | api | `CGTRADER_BEARER_TOKEN` | model3d/cad | title, creator, some engagement | account-dependent fields |
| Cults | api | `CULTS_BASIC_USER/PASS` | model3d | title, thumbnail, engagement metadata | GraphQL schema can shift |
| NASA 3D Resources | api | none | scan3d/model3d/cad | format, source metadata | indexed from public GitHub tree |
| Smithsonian 3D | api | `SMITHSONIAN_API_KEY` | scan3d/model3d | title, thumbnail, license | Open Access API-backed |
| Printables/Thangs/MakerWorld/TurboSquid | link | none | model3d | open-search link card | safe default |
| OpenBuilds / Easel | link | none | cnc | open-search link card | CNC expansion |
| Vectric / Glowforge / xTool | link | none | laser2d/cnc | open-search link card | laser expansion |
