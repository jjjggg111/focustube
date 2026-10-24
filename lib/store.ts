"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, DEFAULT_TAGS } from "./defaults";
import type { Daily, Settings, Video } from "./types";

/** All data stays on this device (PRD 7.1: IndexedDB / Local Storage, no account). */
const KEY = { settings: "ft:settings", daily: "ft:daily", recent: "ft:recent" };

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the app keeps working in memory */
  }
}

function loadSettings(): Settings {
  const s = read<Partial<Settings>>(KEY.settings, {});
  const tags = s.tags?.length ? s.tags : DEFAULT_TAGS;
  // Keep the Shorts system tag even if an older save lacks it.
  if (!tags.some((t) => t.system === "shorts")) tags.push(DEFAULT_TAGS.find((t) => t.system === "shorts")!);
  return { ...DEFAULT_SETTINGS, ...s, tags };
}

function loadDaily(): Daily {
  const d = read<Daily | null>(KEY.daily, null);
  return d && d.date === todayKey() ? d : { date: todayKey(), watchedSec: 0, count: 0 };
}

export function useAppStore() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [daily, setDaily] = useState<Daily>({ date: "", watchedSec: 0, count: 0 });
  const [recent, setRecent] = useState<Video[]>([]);
  const dailyRef = useRef(daily);
  dailyRef.current = daily;

  useEffect(() => {
    setSettings(loadSettings());
    setDaily(loadDaily());
    setRecent(read<Video[]>(KEY.recent, []));
    setReady(true);
  }, []);

  useEffect(() => { if (ready) write(KEY.settings, settings); }, [ready, settings]);
  useEffect(() => { if (ready) write(KEY.recent, recent); }, [ready, recent]);

  // Watch time ticks often; persist it every few seconds and when the page hides.
  useEffect(() => {
    if (!ready) return;
    const save = () => write(KEY.daily, dailyRef.current);
    const id = setInterval(save, 5000);
    const onHide = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => { clearInterval(id); save(); document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", save); };
  }, [ready]);

  /** Adds watched seconds, rolling over to a fresh day after midnight. */
  const addWatch = useCallback((sec: number) => {
    setDaily((d) => (d.date === todayKey() ? { ...d, watchedSec: d.watchedSec + sec } : { date: todayKey(), watchedSec: sec, count: 0 }));
  }, []);

  const startVideo = useCallback((v: Video) => {
    setDaily((d) => (d.date === todayKey() ? { ...d, count: d.count + 1 } : { date: todayKey(), watchedSec: 0, count: 1 }));
    setRecent((r) => [v, ...r.filter((x) => x.id !== v.id)].slice(0, 12));
  }, []);

  /** Extra minutes for today only: the daily goal in Settings stays unchanged. */
  const extendToday = useCallback((minutes: number, goalSec: number) => {
    setDaily((d) => ({ ...d, bonusSec: Math.max(0, d.watchedSec - goalSec) + minutes * 60 }));
  }, []);

  return { ready, settings, setSettings, daily, addWatch, startVideo, extendToday, recent };
}
