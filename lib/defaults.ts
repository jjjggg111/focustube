import type { Settings, Tag } from "./types";

export const DEFAULT_TAGS: Tag[] = [
  { name: "Data Science", policy: "allow", priority: "high", keywords: { ko: "데이터 사이언스 강의", en: "data science tutorial" } },
  { name: "Business & Startups", policy: "allow", priority: "high", keywords: { ko: "스타트업 창업 인사이트", en: "startup founder advice" } },
  { name: "UX & Product Design", policy: "allow", priority: "high", keywords: { ko: "UX 프로덕트 디자인", en: "product design UX" } },
  { name: "English Learning", policy: "allow", priority: "mid", keywords: { ko: "영어 회화 공부", en: "English speaking practice" } },
  { name: "General News", policy: "allow", priority: "mid", keywords: { ko: "오늘의 주요 뉴스", en: "world news today" } },
  { name: "AI News", policy: "limited", priority: "low", keywords: { ko: "AI 뉴스", en: "AI news" } },
  {
    name: "Celebrity & Gossip",
    policy: "block",
    priority: "low",
    keywords: { ko: "연예 가십", en: "celebrity gossip" },
    filterWords: ["연예", "열애", "가십", "아이돌 근황", "celebrity", "gossip", "drama explained"],
  },
  { name: "Shorts", policy: "block", priority: "low", keywords: { ko: "", en: "" }, system: "shorts" },
];

export const DEFAULT_SETTINGS: Settings = {
  goalMin: 150,
  mode: "focus",
  tags: DEFAULT_TAGS,
  blockedChannels: [],
  feedback: {},
  usefulChannels: [],
};

/** Daily picks cap per language tab (PRD 4.5). */
export const PICKS_PER_DAY = 15;
/** Limited tags contribute at most this many videos to daily picks. */
export const LIMITED_PER_DAY = 2;
/**
 * Videos this short are treated as Shorts. YouTube allows Shorts up to 3 minutes,
 * and the Data API has no explicit "is Short" field, so this is an approximation.
 */
export const SHORTS_MAX_SEC = 180;

export const MODES = {
  free: { name: "Free", desc: "Shows time only" },
  notify: { name: "Alert", desc: "Warns at your goal" },
  focus: { name: "Focus", desc: "Blocks the next video" },
} as const;

export const LANGS = { ko: "Korean", en: "English" } as const;
export const PRIORITY_LABEL = { high: "High", mid: "Medium", low: "Low" } as const;
export const POLICY_LABEL = { allow: "Allowed", limited: "Limited", block: "Blocked" } as const;
