export type Lang = "ko" | "en";
export type Policy = "allow" | "limited" | "block";
export type Priority = "high" | "mid" | "low";
export type Mode = "free" | "notify" | "focus";
export type Screen = "home" | "search" | "settings" | "video";

export type Video = {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  thumb: string;
  durationSec: number;
  publishedAt: string;
};

export type Tag = {
  name: string;
  policy: Policy;
  priority: Priority;
  /** Search keyword sent to YouTube for each language tab. */
  keywords: Record<Lang, string>;
  /** Words that hide a video when this tag is blocked. Defaults to the keywords. */
  filterWords?: string[];
  /** "shorts" is a system tag: it controls the Shorts filter, not a search. */
  system?: "shorts";
  custom?: boolean;
};

export type Settings = {
  goalMin: number;
  mode: Mode;
  tags: Tag[];
  blockedChannels: { id: string; name: string }[];
  feedback: Record<string, "good" | "no">;
  usefulChannels: string[];
};

/** Today's usage. bonusSec is extra time chosen at the limit; it resets at midnight. */
export type Daily = { date: string; watchedSec: number; count: number; bonusSec?: number };

export type ApiError = "NO_KEY" | "QUOTA" | "FAILED";
