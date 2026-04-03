<div align="center">

# 🚀 GSMArena + DXOMark API
### Fastify · TypeScript · Vercel

**⚡ The most complete open-source mobile specs API**

Scrapes GSMArena & DXOMark · Blazing-fast two-layer cache · No API key · No signup · Deploy in 2 minutes

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-000000?logo=fastify)](https://fastify.dev/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://vercel.com/)
[![Last Commit](https://img.shields.io/github/last-commit/Sanjeevu-Tarun/mobile-specs-api)](https://github.com/Sanjeevu-Tarun/mobile-specs-api/commits)

[🐛 Report Bug](https://github.com/Sanjeevu-Tarun/mobile-specs-api/issues) · [💡 Request Feature](https://github.com/Sanjeevu-Tarun/mobile-specs-api/issues) · [👤 Follow Me](https://github.com/Sanjeevu-Tarun)

</div>

---

## Why This Exists

Most GSMArena scrapers return half-baked JSON. None of them touch DXOMark. Developers building phone comparison tools, AI assistants, or tech blogs are left stitching together multiple sources manually.

**This API solves that in a single endpoint:**

- ✅ Full GSMArena specs — structured, clean JSON, every field
- ✅ DXOMark scores, sub-scores, pros/cons, and rankings — from a single API call
- ✅ Camera samples organized by category (main, night, zoom, selfie, ultra-wide, video)
- ✅ Device images per colour variant
- ✅ Smart search with penalty scoring so `pixel 9` doesn't bleed into `pixel 9 pro`
- ✅ Two-layer cache (in-memory LRU + Redis) for sub-millisecond repeat responses
- ✅ Serverless on Vercel — zero infrastructure to maintain

---

## What Makes This Different

| Feature | This API | Most others |
|---|---|---|
| **DXOMark scores + sub-scores** | ✅ | ❌ |
| **Camera samples by category** | ✅ | ❌ |
| **Device images per colour** | ✅ | ❌ |
| **Smart search (penalty scoring)** | ✅ | ❌ |
| **Redis + in-memory LRU cache** | ✅ | ❌ |
| **Full review scraping** | ✅ | ❌ |
| **Serverless (no server to run)** | ✅ | ❌ |

> 🏆 **First open-source API combining GSMArena specs and DXOMark camera scores in a single unified response.**

---

## Live Demo

Deploy your own free instance — it takes about 2 minutes:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Sanjeevu-Tarun/mobile-specs-api)

Once deployed, try these right away:

```bash
# All brands
curl https://YOUR-DEPLOYMENT.vercel.app/brands

# Search a phone
curl "https://YOUR-DEPLOYMENT.vercel.app/search?query=samsung+s25+ultra"

# Full specs
curl https://YOUR-DEPLOYMENT.vercel.app/samsung_galaxy_s25_ultra-12552

# DXOMark camera score
curl https://YOUR-DEPLOYMENT.vercel.app/dxomark/samsung-galaxy-s25-ultra
```

> Each deployment runs on its own Vercel account — no shared quota, no rate limit surprises.

---

## Quick Start

**Prerequisites:** [Node.js 18+](https://nodejs.org) · pnpm

```bash
# Install pnpm if you don't have it
npm install -g pnpm

# Clone and run locally
git clone https://github.com/Sanjeevu-Tarun/mobile-specs-api
cd mobile-specs-api
pnpm install
pnpm dev
# → http://localhost:4000
```

> **How it works locally:** `api/index.ts` exports a Vercel handler. `pnpm dev` spins up a local Fastify server on port 4000 purely for development. On Vercel, the handler is called directly — no extra configuration needed.

### Deploy to Vercel

```bash
npm install -g vercel
vercel deploy
```

`vercel.json` is pre-configured. No extra setup required. Or use the one-click button above.

---

## Environment Variables

Optional — the API works without Redis using in-memory cache only.

| Variable | Description |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |

Get free Redis at [console.upstash.com](https://console.upstash.com) → create a database → copy REST URL + token → add to Vercel project settings.

---

## Architecture

```
Client Request
      │
      ▼
  Vercel Edge
      │
      ▼
Fastify Router  ──→  Route Handler
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              LRU Cache      Redis Cache
              (in-memory)    (Upstash)
                    │             │
                    └──────┬──────┘
                           │ cache miss
                           ▼
                     GSMArena / DXOMark
                       (scrapers)
                           │
                           ▼
                     Structured JSON
                      → cached → returned
```

On a cache hit (layer 1), response time is effectively **zero latency**. On a cache miss, the scraper fetches, parses, stores in both layers, and responds — cold start included.

---

## Performance

This API is built for speed at every layer:

**Layer 1 — In-Memory LRU Cache**
- Holds up to 300 entries
- 30-day TTL
- Zero network overhead — always checked first

**Layer 2 — Redis via Upstash**
- Checked on memory miss (e.g. cold Vercel start)
- Persists indefinitely across deployments
- Makes cold starts nearly indistinguishable from warm ones

**Cache key versioning** (`gsm:phone-full:v3`) means bumping the version in code instantly invalidates stale data — no manual flush needed.

---

## API Reference

<details>
<summary><b>🏷️ Brands</b></summary>

### Get all brands
```
GET /brands
```
```bash
curl https://YOUR-DEPLOYMENT.vercel.app/brands
```
```json
{
  "status": true,
  "data": {
    "Samsung": {
      "brand_id": 9,
      "brand_slug": "samsung-phones-9",
      "device_count": 2108,
      "detail_url": "/brands/samsung-phones-9"
    }
  }
}
```

### Get phones by brand
```
GET /brands/:brandSlug
```
```bash
curl https://YOUR-DEPLOYMENT.vercel.app/brands/samsung-phones-9
```

</details>

<details>
<summary><b>🔍 Discovery & Search</b></summary>

| Endpoint | Description |
|---|---|
| `GET /latest` | Latest released phones |
| `GET /top-by-interest` | Top phones by daily hits |
| `GET /top-by-fans` | Top phones by total favorites |
| `GET /search?query=<q>` | Search by device name |

```bash
curl "https://YOUR-DEPLOYMENT.vercel.app/search?query=pixel+9+pro"
```
```json
{
  "status": true,
  "data": [
    {
      "name": "Google Pixel 9 Pro",
      "slug": "google_pixel_9_pro-12445",
      "imageUrl": "https://fdn2.gsmarena.com/vv/bigpic/google-pixel-9-pro.jpg",
      "detail_url": "/google_pixel_9_pro-12445"
    }
  ]
}
```

> Search uses a **penalty scoring system** — querying `pixel 9` won't return `pixel 9 pro` or `pixel 9 xl` unless explicitly asked.

</details>

<details>
<summary><b>📋 Device Specs</b></summary>

```
GET /:slug
```

Returns full GSMArena specs plus two enhanced fields:
- `device_images` — `{ color, url }` for every colour variant
- `review_url` — link to the GSMArena review if one exists

```bash
curl https://YOUR-DEPLOYMENT.vercel.app/samsung_galaxy_s25_ultra-12552
```
```json
{
  "status": true,
  "data": {
    "name": "Samsung Galaxy S25 Ultra",
    "slug": "samsung_galaxy_s25_ultra-12552",
    "review_url": "https://www.gsmarena.com/samsung_galaxy_s25_ultra-review-2631.php",
    "device_images": [
      { "color": "Titanium Black", "url": "https://fdn2.gsmarena.com/…/titanium-black.jpg" }
    ],
    "specs": { "...": "..." }
  }
}
```

</details>

<details>
<summary><b>📸 Reviews & Camera Samples</b></summary>

`reviewSlug` = review URL slug without `.php`  
e.g. `gsmarena.com/samsung_galaxy_s25_ultra-review-2631.php` → `samsung_galaxy_s25_ultra-review-2631`

| Endpoint | Description |
|---|---|
| `GET /review/:reviewSlug` | Full review — hero images, article images, camera samples |
| `GET /review/:reviewSlug/camera-samples` | Camera samples only |
| `GET /review/:reviewSlug/images` | Hero + article images only |

```bash
curl https://YOUR-DEPLOYMENT.vercel.app/review/samsung_galaxy_s25_ultra-review-2631
```
```json
{
  "status": true,
  "data": {
    "device": "Samsung Galaxy S25 Ultra",
    "reviewUrl": "https://www.gsmarena.com/…",
    "heroImages": ["https://…/img.jpg"],
    "cameraSamples": [
      { "label": "Main Camera",       "images": ["…"] },
      { "label": "Night / Low Light", "images": ["…"] },
      { "label": "Zoom",              "images": ["…"] },
      { "label": "Selfie",            "images": ["…"] },
      { "label": "Ultra-Wide",        "images": ["…"] },
      { "label": "Video",             "images": ["…"] }
    ]
  }
}
```

**Camera sample categories:**

| Label | Matched keywords |
|---|---|
| Main Camera | main, daylight, outdoor |
| Night / Low Light | night, low light |
| Zoom | zoom, tele |
| Selfie | selfie, front |
| Ultra-Wide | wide, ultra-wide |
| Portrait | portrait |
| Macro | macro |
| Video | video |
| Indoor | indoor |

</details>

<details>
<summary><b>🎯 DXOMark — Unique Feature</b></summary>

> **This is the only open-source API that combines GSMArena specs with live DXOMark camera scores.**

| Endpoint | Description |
|---|---|
| `GET /dxomark/:slug` | Overall score, sub-scores, pros/cons, ranking |
| `GET /dxomark/search?query=<q>` | Search DXOMark by device name |
| `GET /dxomark/url?url=<dxomark-url>` | Scrape any DXOMark page by URL |

```bash
curl https://YOUR-DEPLOYMENT.vercel.app/dxomark/samsung-galaxy-s25-ultra
```
```json
{
  "status": true,
  "data": {
    "device": "Samsung Galaxy S25 Ultra",
    "overall": 163,
    "scores": {
      "photo": 158,
      "video": 148,
      "zoom": 166,
      "bokeh": 68,
      "preview": 107
    },
    "ranking": 3,
    "pros": ["Excellent zoom range", "Outstanding low-light photo"],
    "cons": ["Average bokeh rendering"]
  }
}
```

</details>

---

## Use Cases

This API is a good fit for:

- **Mobile comparison platforms** — pull full specs + DXOMark scores side by side
- **Tech blogs & review sites** — embed live specs without maintaining a database
- **AI assistants & chatbots** — give your LLM structured phone knowledge
- **Mobile apps** — display device info, camera benchmarks, and colour variants
- **Price trackers** — pair device specs with pricing APIs for richer context
- **Research tools** — scrape and analyse smartphone trends at scale

---

## Project Structure

```
├── api/
│   └── index.ts                    # Fastify routes + Vercel handler + local dev server
└── src/
    ├── server.ts                   # baseUrl constant
    ├── cache.ts                    # Redis (Upstash) + in-memory LRU cache
    ├── types.ts                    # TypeScript interfaces
    └── parser/
        ├── parser.service.ts       # getHtml(), search, latest, top lists
        ├── parser.brands.ts        # getBrands() with multi-selector fallback
        ├── parser.phone-details.ts # getPhoneDetails() + device_images + review_url
        ├── parser.review.ts        # getReviewDetails() — hero, article, camera samples
        └── parser.dxomark.ts       # DXOMark scores, sub-scores, search, rankings
```

---

## Contributing

Issues and PRs are welcome. For major changes, please open an issue first to discuss what you'd like to change.

```bash
git checkout -b feature/your-feature
# make your changes
git commit -m "feat: describe your change"
git push origin feature/your-feature
# open a pull request
```

---

## ⚠️ Disclaimer

This project scrapes publicly accessible pages for personal and educational use. It is not affiliated with GSMArena or DXOMark. Use responsibly and respect their terms of service.

---

## ⭐ Support

If this project saved you time, a star goes a long way — it helps other developers find it.

[![Star this repo](https://img.shields.io/github/stars/Sanjeevu-Tarun/mobile-specs-api?style=social)](https://github.com/Sanjeevu-Tarun/mobile-specs-api)

---

<!-- SEO: GSMArena API, DXOMark API, Phone Specs API, Mobile Specs API, Fastify API, TypeScript REST API, Vercel Serverless API, smartphone specs scraper, camera score API, open source phone database -->

## 📄 License

[MIT](./LICENSE) © 2026 — Made with ❤️ by [Sanjeevu-Tarun](https://github.com/Sanjeevu-Tarun)
