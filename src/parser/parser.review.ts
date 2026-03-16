/**
 * parser.review.ts
 *
 * Scrapes a GSMArena review page and its camera-samples sub-page.
 *
 * Review URL pattern : https://www.gsmarena.com/<device>-review-<id>.php
 * Camera samples URL : https://www.gsmarena.com/<device>-review-<id>p<page>.php
 *
 * The camera-samples section has multiple "tabs" / categories.
 * Each tab is linked from the review page with a URL like:
 *   …review-<id>p2.php  (Daylight)
 *   …review-<id>p3.php  (Low light / Night)
 *   …review-<id>p4.php  (Zoom)
 *   …review-<id>p5.php  (Selfie)
 *   …review-<id>p6.php  (Video)
 * etc.
 *
 * Because GSMArena does not guarantee a fixed page-number ↔ category mapping,
 * we discover them dynamically from the tab links on the review page itself.
 */

import * as cheerio from 'cheerio';
import { baseUrl } from '../server';
import { getHtml } from './parser.service';
import {
  IReviewResult,
  ICameraSampleCategory,
  ICameraSample,
  IReviewGallerySection,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function absoluteUrl(href: string): string {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  return `${baseUrl}/${href.replace(/^\//, '')}`;
}

function cleanImgUrl(src: string | undefined): string {
  if (!src) return '';
  return absoluteUrl(src.trim());
}

/**
 * Normalise a raw tab / heading label into a canonical category string.
 * e.g.  "Main cam"  →  "Main Camera"
 *       "low light" →  "Night / Low Light"
 */
function normaliseCategory(raw: string): string {
  const s = raw.trim();
  if (!s) return 'Unknown';

  const lower = s.toLowerCase();
  if (/selfie|front/.test(lower)) return 'Selfie';
  if (/night|low.?light/.test(lower)) return 'Night / Low Light';
  if (/zoom|tele/.test(lower)) return 'Zoom';
  if (/video/.test(lower)) return 'Video';
  if (/portrait/.test(lower)) return 'Portrait';
  if (/wide|ultra.?wide/.test(lower)) return 'Ultra-Wide';
  if (/daylight|outdoor|main/.test(lower)) return 'Main Camera';
  if (/indoor/.test(lower)) return 'Indoor';
  if (/macro/.test(lower)) return 'Macro';
  if (/sample/.test(lower)) return 'Camera Samples';

  // Title-case the raw label as fallback
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Camera-samples page scraper
// ---------------------------------------------------------------------------

/**
 * Scrape all sample images from a single camera-samples sub-page.
 * Images live in  .camera-sample  or  #sample-photos  containers.
 */
async function scrapeSamplesPage(url: string, label: string): Promise<ICameraSample[]> {
  let html: string;
  try {
    html = await getHtml(url);
  } catch {
    return [];
  }

  const $ = cheerio.load(html);
  const samples: ICameraSample[] = [];
  const seen = new Set<string>();

  function pushSample(imgUrl: string, caption: string, thumbUrl?: string) {
    if (!imgUrl || seen.has(imgUrl)) return;
    seen.add(imgUrl);
    samples.push({
      category: label,
      url: imgUrl,
      thumbnailUrl: thumbUrl,
      caption: caption || undefined,
    });
  }

  // ── Pattern 1: .camera-sample ul li ──────────────────────────────────────
  $('.camera-sample ul li, .camera-samples ul li, #camera-sample ul li').each((_, el) => {
    const a = $(el).find('a');
    const img = $(el).find('img');
    const href = a.attr('href');
    const src = img.attr('src') || img.attr('data-src') || '';
    const caption = img.attr('alt') || a.attr('title') || '';
    const fullUrl = href ? absoluteUrl(href) : cleanImgUrl(src);
    const thumbUrl = src ? cleanImgUrl(src) : undefined;
    pushSample(fullUrl, caption, thumbUrl);
  });

  // ── Pattern 2: #sample-photos / .sample-photos div ───────────────────────
  if (samples.length === 0) {
    $('#sample-photos img, .sample-photos img, .review-photos img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      const caption = $(el).attr('alt') || '';
      const parentHref = $(el).parent('a').attr('href');
      const fullUrl = parentHref ? absoluteUrl(parentHref) : cleanImgUrl(src);
      pushSample(fullUrl, caption, cleanImgUrl(src) || undefined);
    });
  }

  // ── Pattern 3: Generic article images (fallback) ─────────────────────────
  if (samples.length === 0) {
    $('article img, .review-body img, .gsmarena-article img, .article img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (!src || src.includes('icon') || src.includes('logo')) return;
      const caption = $(el).attr('alt') || '';
      const parentHref = $(el).parent('a').attr('href');
      const fullUrl = parentHref ? absoluteUrl(parentHref) : cleanImgUrl(src);
      pushSample(fullUrl, caption, cleanImgUrl(src) || undefined);
    });
  }

  return samples;
}

// ---------------------------------------------------------------------------
// Review page main scraper
// ---------------------------------------------------------------------------

export async function getReviewDetails(reviewSlug: string): Promise<IReviewResult> {
  // reviewSlug is the full slug including "-review-NNNNpX" suffix
  // e.g.  samsung_galaxy_s26_ultra-review-2939p5
  // We normalise to the first page (p1 or no suffix) for the main review
  const baseReviewSlug = reviewSlug.replace(/-review-(\d+)p\d+$/, '-review-$1');
  const reviewUrl = `${baseUrl}/${baseReviewSlug}.php`;

  let html: string;
  try {
    html = await getHtml(reviewUrl);
  } catch (err) {
    throw new Error(`Failed to fetch review page: ${reviewUrl}. ${err}`);
  }

  const $ = cheerio.load(html);

  // ── Device name ────────────────────────────────────────────────────────────
  const device =
    $('h1.article-info-name').text().trim() ||
    $('h1').first().text().trim() ||
    baseReviewSlug;

  // ── Hero images ────────────────────────────────────────────────────────────
  const heroImages: string[] = [];
  const heroSeen = new Set<string>();
  $('.article-info-top img, .review-header img, .article-header img, header img').each((_, el) => {
    const src = cleanImgUrl($(el).attr('src') || $(el).attr('data-src'));
    if (src && !heroSeen.has(src)) { heroSeen.add(src); heroImages.push(src); }
  });

  // ── Discover camera-sample tab links ──────────────────────────────────────
  //
  // GSMArena renders nav tabs inside  .article-nav  or  .review-nav  or as
  // plain <a> links whose href matches …-review-NNNNpX.php
  //
  const reviewIdMatch = baseReviewSlug.match(/-review-(\d+)$/);
  const reviewId = reviewIdMatch ? reviewIdMatch[1] : '';

  interface TabLink { label: string; url: string }
  const tabLinks: TabLink[] = [];
  const tabSeen = new Set<string>();

  // Strategy A – explicit nav tabs
  $('a[href*="-review-"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    // Must reference the same review id and have a page suffix pN
    if (reviewId && !href.includes(`-review-${reviewId}p`)) return;
    const url = absoluteUrl(href);
    if (tabSeen.has(url)) return;
    tabSeen.add(url);
    const rawLabel =
      $(el).text().trim() ||
      $(el).attr('title') ||
      $(el).find('span').text().trim() ||
      '';
    tabLinks.push({ label: normaliseCategory(rawLabel || 'Camera Samples'), url });
  });

  // Strategy B – if no tabs found but we know the review ID, probe common page numbers
  if (tabLinks.length === 0 && reviewId) {
    const commonPages = [
      { page: 2, label: 'Main Camera' },
      { page: 3, label: 'Night / Low Light' },
      { page: 4, label: 'Zoom' },
      { page: 5, label: 'Selfie' },
      { page: 6, label: 'Video' },
      { page: 7, label: 'Ultra-Wide' },
    ];
    for (const { page, label } of commonPages) {
      const url = `${baseUrl}/${baseReviewSlug}p${page}.php`;
      tabLinks.push({ label, url });
    }
  }

  // ── Scrape each tab in parallel ────────────────────────────────────────────
  const cameraSamples: ICameraSampleCategory[] = [];

  await Promise.all(
    tabLinks.map(async ({ label, url }) => {
      const images = await scrapeSamplesPage(url, label);
      if (images.length > 0) {
        cameraSamples.push({ label, images });
      }
    })
  );

  // Sort tabs in a sensible order
  const categoryOrder = [
    'Main Camera', 'Daylight', 'Ultra-Wide', 'Zoom', 'Portrait',
    'Indoor', 'Night / Low Light', 'Selfie', 'Macro', 'Video',
  ];
  cameraSamples.sort((a, b) => {
    const ai = categoryOrder.indexOf(a.label);
    const bi = categoryOrder.indexOf(b.label);
    if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  // ── In-article images grouped by nearest heading ───────────────────────────
  const articleImages: IReviewGallerySection[] = [];
  const articleSeen = new Set<string>();
  let currentSection = 'Introduction';

  $('article *, .review-body *, .gsmarena-article *').each((_, el) => {
    const tag = (el as any).tagName?.toLowerCase();
    if (!tag) return;

    // Section heading detection
    if (/^h[1-6]$/.test(tag)) {
      const text = $(el).text().trim();
      if (text) currentSection = text;
      return;
    }

    // Image elements
    if (tag === 'img') {
      const src = cleanImgUrl($(el).attr('src') || $(el).attr('data-src'));
      if (!src || src.includes('icon') || src.includes('logo') || src.includes('spacer')) return;
      if (articleSeen.has(src)) return;
      articleSeen.add(src);

      const caption = $(el).attr('alt') || $(el).attr('title') || '';
      const parentHref = $(el).parent('a').attr('href');
      const fullUrl = parentHref ? absoluteUrl(parentHref) : src;

      let section = articleImages.find(s => s.section === currentSection);
      if (!section) {
        section = { section: currentSection, images: [] };
        articleImages.push(section);
      }
      section.images.push({
        category: normaliseCategory(currentSection),
        url: fullUrl,
        thumbnailUrl: src !== fullUrl ? src : undefined,
        caption: caption || undefined,
      });
    }
  });

  return {
    device,
    reviewSlug: baseReviewSlug,
    reviewUrl,
    heroImages,
    articleImages,
    cameraSamples,
  };
}
