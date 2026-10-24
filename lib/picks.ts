"use client";
import { LIMITED_PER_DAY, PICKS_PER_DAY, SHORTS_MAX_SEC } from "./defaults";
import { read, todayKey, write } from "./store";
import type { ApiError, Lang, Settings, Tag, Video } from "./types";

export class SearchFailed extends Error {
  constructor(public code: ApiError) { super(code); }
}

const PREFIX = "ft:cache:";

/** Drop cached results from earlier days so storage doesn't grow. */
export function pruneCache() {
  try {
    const today = todayKey();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX) && !k.startsWith(PREFIX + today)) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

const inflight = new Map<string, Promise<Video[]>>();

/**
 * One YouTube search per (query, language) per day: results are kept on the device
 * until midnight, which keeps daily picks inside the default search quota.
 */
export function searchCached(q: string, lang: Lang): Promise<Video[]> {
  const key = `${PREFIX}${todayKey()}:${lang}:${q.trim().toLowerCase()}`;
  const hit = read<Video[] | null>(key, null);
  if (hit) return Promise.resolve(hit);
  if (inflight.has(key)) return inflight.get(key)!;
  const p = fetch(`/api/youtube/search?${new URLSearchParams({ q, lang })}`)
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new SearchFailed((body.error as ApiError) ?? "FAILED");
      write(key, body.videos);
      return body.videos as Video[];
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

const norm = (s: string) => s.toLowerCase();

/** Why a video is hidden by the user's own rules, or null if it can be shown. */
export function hiddenReason(v: Video, s: Settings): string | null {
  const shorts = s.tags.find((t) => t.system === "shorts");
  if (shorts?.policy === "block" && (v.durationSec > 0 && v.durationSec <= SHORTS_MAX_SEC || /#shorts/i.test(v.title))) return "Shorts";
  if (s.blockedChannels.some((c) => c.id === v.channelId)) return "blocked channel";
  if (s.feedback[v.id] === "no") return "not interested";
  const title = norm(v.title);
  for (const t of s.tags) {
    if (t.policy !== "block" || t.system) continue;
    const words = t.filterWords?.length ? t.filterWords : [t.keywords.ko, t.keywords.en, t.name];
    if (words.some((w) => w && title.includes(norm(w)))) return "blocked tag";
  }
  return null;
}

export const searchTags = (s: Settings) => s.tags.filter((t) => !t.system && t.policy !== "block");

/** Useful-rated channels first, otherwise keep YouTube's relevance order. */
function rankWithin(list: Video[], s: Settings) {
  const useful = new Set(s.usefulChannels);
  return [...list].sort((a, b) => Number(useful.has(b.channelId)) - Number(useful.has(a.channelId)));
}

/**
 * Daily picks for one language: allowed tags by priority, taking turns between tags
 * so one topic can't fill the list; limited tags add at most LIMITED_PER_DAY at the end.
 */
export function buildPicks(results: Map<string, Video[]>, s: Settings): Video[] {
  const seen = new Set<string>();
  const take = (v: Video) => (seen.has(v.id) || hiddenReason(v, s) ? false : (seen.add(v.id), true));
  const out: Video[] = [];
  const tags = searchTags(s);
  for (const pri of ["high", "mid", "low"] as const) {
    const queues = tags.filter((t) => t.policy === "allow" && t.priority === pri).map((t) => rankWithin(results.get(t.name) ?? [], s));
    while (queues.some((q) => q.length) && out.length < PICKS_PER_DAY) {
      for (const q of queues) {
        while (q.length) { const v = q.shift()!; if (take(v)) { out.push(v); break; } }
        if (out.length >= PICKS_PER_DAY) break;
      }
    }
  }
  const limited: Video[] = [];
  for (const t of tags.filter((t) => t.policy === "limited")) {
    for (const v of rankWithin(results.get(t.name) ?? [], s)) {
      if (limited.length >= LIMITED_PER_DAY) break;
      if (take(v)) limited.push(v);
    }
  }
  return [...out.slice(0, PICKS_PER_DAY - limited.length), ...limited];
}

/** Videos for a single tag chip (not capped by daily picks). */
export function tagVideos(tag: Tag, results: Map<string, Video[]>, s: Settings): Video[] {
  return rankWithin((results.get(tag.name) ?? []).filter((v) => !hiddenReason(v, s)), s);
}
