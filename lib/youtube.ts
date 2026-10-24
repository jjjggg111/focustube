import "server-only";
import type { Lang, Video } from "./types";

const API = "https://www.googleapis.com/youtube/v3";
/** Identical searches are served from Next's data cache for 6 hours to save quota. */
const REVALIDATE_SEC = 60 * 60 * 6;

export class YouTubeError extends Error {
  constructor(public code: "NO_KEY" | "QUOTA" | "FAILED", message?: string) {
    super(message ?? code);
  }
}

type SearchItem = {
  id: { videoId?: string };
  snippet: {
    title: string;
    channelTitle: string;
    channelId: string;
    publishedAt: string;
    liveBroadcastContent?: string;
    thumbnails?: Record<string, { url: string }>;
  };
};
type VideoItem = {
  id: string;
  contentDetails?: { duration?: string };
  snippet?: { defaultAudioLanguage?: string; defaultLanguage?: string };
};

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new YouTubeError("NO_KEY");
  const url = `${API}/${path}?${new URLSearchParams({ ...params, key })}`;
  const res = await fetch(url, { next: { revalidate: REVALIDATE_SEC } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const reason: string | undefined = body?.error?.errors?.[0]?.reason;
    if (res.status === 403 && reason && /quota|rateLimit/i.test(reason)) throw new YouTubeError("QUOTA", reason);
    throw new YouTubeError("FAILED", `${res.status} ${reason ?? ""}`.trim());
  }
  return res.json() as Promise<T>;
}

/** ISO 8601 duration (PT1H2M3S) → seconds. */
function parseDuration(iso = ""): number {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

/** Search snippets come HTML-escaped (&#39; &amp; …). */
function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const HANGUL = /[가-힣]/;

/**
 * relevanceLanguage only ranks results; it does not filter them.
 * So each tab also checks the title script and the video's declared language.
 */
function matchesLang(title: string, declared: string | undefined, lang: Lang): boolean {
  const hasHangul = HANGUL.test(title);
  const d = declared?.toLowerCase();
  if (lang === "ko") return hasHangul || !!d?.startsWith("ko");
  if (hasHangul) return false;
  return !d || d.startsWith("en");
}

/** YOUTUBE_MOCK=1 returns sample results so the UI can be developed without spending quota. */
function mockVideos(q: string, lang: Lang): Video[] {
  const ko = lang === "ko";
  return Array.from({ length: 8 }, (_, i) => ({
    id: `mock-${lang}-${encodeURIComponent(q)}-${i}`,
    title: ko ? `${q} 샘플 영상 ${i + 1}: 실제 API를 연결하면 진짜 검색 결과가 여기에 표시됩니다` : `${q} sample video ${i + 1}: real search results appear here once the API is connected`,
    channel: ko ? `샘플 채널 ${(i % 3) + 1}` : `Sample Channel ${(i % 3) + 1}`,
    channelId: `mock-ch-${lang}-${i % 3}`,
    thumb: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg",
    durationSec: i === 7 ? 45 : 300 + i * 137,
    publishedAt: new Date().toISOString(),
  }));
}

export async function searchVideos(q: string, lang: Lang, maxResults = 15): Promise<Video[]> {
  if (process.env.YOUTUBE_MOCK === "1") return mockVideos(q, lang);
  const search = await call<{ items: SearchItem[] }>("search", {
    part: "snippet",
    type: "video",
    q,
    maxResults: String(Math.min(50, maxResults)),
    relevanceLanguage: lang,
    regionCode: lang === "ko" ? "KR" : "US",
    safeSearch: "moderate",
  });
  const items = search.items.filter((i) => i.id.videoId && (i.snippet.liveBroadcastContent ?? "none") === "none");
  if (!items.length) return [];

  const details = await call<{ items: VideoItem[] }>("videos", {
    part: "contentDetails,snippet",
    id: items.map((i) => i.id.videoId!).join(","),
  });
  const byId = new Map(details.items.map((d) => [d.id, d]));

  return items.flatMap((i) => {
    const id = i.id.videoId!;
    const d = byId.get(id);
    const title = decode(i.snippet.title);
    const declared = d?.snippet?.defaultAudioLanguage ?? d?.snippet?.defaultLanguage;
    if (!matchesLang(title, declared, lang)) return [];
    const t = i.snippet.thumbnails ?? {};
    return [
      {
        id,
        title,
        channel: decode(i.snippet.channelTitle),
        channelId: i.snippet.channelId,
        thumb: (t.high ?? t.medium ?? t.default)?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        durationSec: parseDuration(d?.contentDetails?.duration),
        publishedAt: i.snippet.publishedAt,
      },
    ];
  });
}
