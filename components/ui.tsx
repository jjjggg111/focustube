"use client";
import type { ReactNode } from "react";
import { LANGS } from "@/lib/defaults";
import type { Lang, Video } from "@/lib/types";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const C = {
  chip: "shrink-0 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 aria-pressed:border-zinc-900 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:aria-pressed:border-zinc-100 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900",
  btn: "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-default disabled:opacity-40 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400",
  ghost: "inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-default disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  input: "min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100",
  note: "rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[13px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  label: "text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400",
  card: "overflow-hidden rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:divide-zinc-700",
  link: "text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400",
  focus: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
  muted: "text-zinc-500 dark:text-zinc-400",
  h: "text-base font-semibold tracking-tight lg:text-lg",
};

/** Material Symbols Rounded, weight 200. `fill` switches to the filled style. */
export function Icon({ name, fill, className }: { name: string; fill?: boolean; className?: string }) {
  return <span aria-hidden className={cx("ms", fill && "fill", className)}>{name}</span>;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const fmtClock = (s: number) => { s = Math.floor(s); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };
export const fmtDur = (s: number) => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; };
export const fmtHM = (s: number) => { s = Math.max(0, Math.round(s / 60)); const h = Math.floor(s / 60), m = s % 60; return h && m ? `${h}h ${pad(m)}m` : h ? `${h}h` : `${m}m`; };

export function Thumb({ v, className }: { v: Video; className?: string }) {
  return (
    <div className={cx("relative aspect-video w-full overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={v.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
      {v.durationSec > 0 && (
        <span className="tnum absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1 text-[11px] font-medium text-white">{fmtDur(v.durationSec)}</span>
      )}
    </div>
  );
}

export function VideoCard({ v, onOpen }: { v: Video; onOpen: (v: Video) => void }) {
  return (
    <button onClick={() => onOpen(v)} className={cx("group grid min-w-0 grid-cols-[118px_minmax(0,1fr)] items-start gap-3 rounded-lg text-left sm:grid-cols-[168px_minmax(0,1fr)] lg:flex lg:flex-col lg:gap-2.5", C.focus)}>
      <Thumb v={v} className="transition group-hover:brightness-110" />
      <div className="min-w-0">
        <div title={v.title} className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{v.title}</div>
        <div className={cx("mt-1 truncate text-[12.5px]", C.muted)}>{v.channel}</div>
      </div>
    </button>
  );
}

export function VideoGrid({ videos, onOpen }: { videos: Video[]; onOpen: (v: Video) => void }) {
  return (
    <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-2 lg:gap-x-5 lg:gap-y-7 xl:grid-cols-3 2xl:grid-cols-4">
      {videos.map((v) => <VideoCard key={v.id} v={v} onOpen={onOpen} />)}
    </div>
  );
}

export function SkeletonGrid({ n = 6 }: { n?: number }) {
  return (
    <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-2 lg:gap-x-5 lg:gap-y-7 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="grid grid-cols-[118px_1fr] gap-3 sm:grid-cols-[168px_1fr] lg:flex lg:flex-col">
          <div className="aspect-video w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex flex-col gap-2 pt-1"><div className="h-3.5 w-11/12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" /><div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" /></div>
        </div>
      ))}
    </div>
  );
}

export function LangTabs({ lang, onChange, count }: { lang: Lang; onChange: (l: Lang) => void; count: (l: Lang) => number | null }) {
  return (
    <div role="tablist" className="grid grid-cols-2 border-b border-zinc-200 dark:border-zinc-700 lg:flex lg:gap-6">
      {(Object.keys(LANGS) as Lang[]).map((k) => {
        const n = count(k);
        return (
          <button key={k} role="tab" aria-selected={lang === k} onClick={() => onChange(k)}
            className={cx("-mb-px flex items-baseline justify-center gap-1.5 border-b-2 py-2 text-sm font-semibold", C.focus,
              lang === k ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200")}>
            {LANGS[k]}{n !== null && <span className="tnum text-[11.5px] font-medium">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("flex flex-col gap-3", className)}>{children}</section>;
}
