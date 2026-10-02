import type { ImageResult } from "./types";

/**
 * Real-photo search using the Wikimedia Commons API (free, no API key).
 * Every result is freely licensed and links back to its source page for attribution.
 */
const ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "NexaGPT/1.0 (local ChatGPT-style app)";
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

interface CommonsPage {
  title: string;
  index: number;
  imageinfo?: {
    url: string;
    descriptionurl: string;
    thumburl?: string;
    width: number;
    height: number;
    mime: string;
    responsiveUrls?: Record<string, string>;
    extmetadata?: Record<string, { value?: string }>;
  }[];
}

function stripHtml(html: string | undefined): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(fileTitle: string): string {
  return fileTitle
    .replace(/^File:/, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_]+/g, " ")
    .trim();
}

// Excludes scanned book pages, which otherwise flood results for longer queries.
const EXCLUDE =
  'filew:>800 -insource:"Internet Archive Book Images" -incategory:"Files from the Biodiversity Heritage Library"';
const SCAN_TITLE = /\(\d{4}\) \(\d{8,}\)$/;

async function querySearch(query: string, limit: number, signal?: AbortSignal): Promise<ImageResult[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap ${EXCLUDE}`,
    gsrnamespace: "6",
    gsrlimit: String(limit + 6),
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "640",
    iiextmetadatafilter: "Artist|LicenseShortName",
  });

  const timeout = AbortSignal.timeout(10_000);
  const res = await fetch(`${ENDPOINT}?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) throw new Error(`Image search failed (${res.status})`);

  const data = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => a.index - b.index);

  const results: ImageResult[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info || !ALLOWED_MIME.has(info.mime) || info.width < 400 || info.height < 300) continue;
    const ratio = info.width / info.height;
    const title = cleanTitle(page.title);
    if (ratio > 3 || ratio < 1 / 3 || SCAN_TITLE.test(title)) continue;
    results.push({
      thumbUrl: info.thumburl ?? info.url,
      fullUrl: info.responsiveUrls?.["2"] ?? info.responsiveUrls?.["1.5"] ?? info.thumburl ?? info.url,
      sourceUrl: info.descriptionurl,
      title,
      author: stripHtml(info.extmetadata?.Artist?.value).slice(0, 120) || undefined,
      license: stripHtml(info.extmetadata?.LicenseShortName?.value) || undefined,
      width: info.width,
      height: info.height,
    });
    if (results.length >= limit) break;
  }
  return results;
}

/**
 * Finds up to `count` photos. Long queries often match few files, so the query is
 * progressively shortened (dropping trailing words) until there are enough results.
 */
export async function searchImages(query: string, count = 4, signal?: AbortSignal): Promise<ImageResult[]> {
  const limit = Math.min(Math.max(count, 1), 8);
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 8);
  const results: ImageResult[] = [];
  const seen = new Set<string>();

  for (let n = words.length; n >= 1 && results.length < limit; n--) {
    for (const img of await querySearch(words.slice(0, n).join(" "), limit, signal)) {
      if (seen.has(img.sourceUrl) || results.length >= limit) continue;
      seen.add(img.sourceUrl);
      results.push(img);
    }
  }
  return results;
}
