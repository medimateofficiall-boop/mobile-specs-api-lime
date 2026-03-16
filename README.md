# GSMArena Parser API — Enhanced

A TypeScript/Fastify REST API that scrapes GSMArena for device specs, reviews, device images, and fully classified camera samples.

---

## Setup

```bash
pnpm install
pnpm dev        # hot-reload dev server
pnpm build      # compile to dist/
pnpm start      # run compiled build
```

---

## Endpoints

### Brands

| Method | Path | Description |
|--------|------|-------------|
| GET | `/brands` | All brands with device count |
| GET | `/brands/:brandSlug` | Phones listed under a brand |

### Discovery

| Method | Path | Description |
|--------|------|-------------|
| GET | `/latest` | Latest phones |
| GET | `/top-by-interest` | Top phones by daily hits |
| GET | `/top-by-fans` | Top phones by total favorites |
| GET | `/search?query=<q>` | Search by device name |

### Device Specs — enhanced

```
GET /:slug
```

Returns full specs plus two new fields:
- **`device_images`** – array of `{ color, url }` for every colour variant
- **`review_url`** – absolute URL to the review page if one exists

Example: `GET /samsung_galaxy_s26_ultra-12548`

---

### Review & Images — new

#### Full review

```
GET /review/:reviewSlug
```

`reviewSlug` = slug portion of the review URL without `.php`, e.g.  
`samsung_galaxy_s26_ultra-review-2939p5`

Response shape:
```jsonc
{
  "status": true,
  "data": {
    "device": "Samsung Galaxy S26 Ultra",
    "reviewSlug": "samsung_galaxy_s26_ultra-review-2939",
    "reviewUrl": "https://www.gsmarena.com/...",
    "heroImages": ["https://…/img.jpg"],
    "articleImages": [
      {
        "section": "Design",
        "images": [{ "category": "Main Camera", "url": "…", "thumbnailUrl": "…", "caption": "…" }]
      }
    ],
    "cameraSamples": [
      { "label": "Main Camera",       "images": [ … ] },
      { "label": "Night / Low Light", "images": [ … ] },
      { "label": "Zoom",              "images": [ … ] },
      { "label": "Selfie",            "images": [ … ] },
      { "label": "Video",             "images": [ … ] },
      { "label": "Ultra-Wide",        "images": [ … ] }
    ]
  }
}
```

#### Camera samples only

```
GET /review/:reviewSlug/camera-samples
```

#### Article / hero images only

```
GET /review/:reviewSlug/images
```

---

## Camera sample categories

| Label | Triggered by |
|-------|-------------|
| Main Camera | main / daylight / outdoor tabs |
| Night / Low Light | night / low light tabs |
| Zoom | zoom / tele tabs |
| Selfie | selfie / front tabs |
| Ultra-Wide | wide / ultra-wide tabs |
| Portrait | portrait tabs |
| Macro | macro tabs |
| Video | video tabs |
| Indoor | indoor tabs |

---

## Project structure

```
├── api/
│   └── index.ts                    # Fastify routes (Vercel handler)
└── src/
    ├── server.ts                   # baseUrl constant
    ├── types.ts                    # All TypeScript interfaces
    └── parser/
        ├── parser.service.ts       # getHtml, search, latest, top lists
        ├── parser.brands.ts        # getBrands
        ├── parser.phone-details.ts # getPhoneDetails (+ device_images, review_url)
        └── parser.review.ts        # getReviewDetails (hero, article, camera samples)
```
