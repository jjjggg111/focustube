"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { LANGS, MODES, POLICY_LABEL, PRIORITY_LABEL, SHORTS_MAX_SEC } from "@/lib/defaults";
import { buildPicks, hiddenReason, pruneCache, searchCached, searchTags, SearchFailed, tagVideos } from "@/lib/picks";
import { useAppStore } from "@/lib/store";
import type { ApiError, Lang, Mode, Policy, Screen, Settings, Tag, Video } from "@/lib/types";
import { Player, type PlayerHandle } from "./Player";
import { C, cx, fmtClock, fmtHM, Icon, LangTabs, Section, SkeletonGrid, Thumb, VideoGrid } from "./ui";

const NAV: [Exclude<Screen, "video">, string, string][] = [["home", "Home", "home"], ["search", "Search", "search"], ["settings", "Settings", "settings"]];

const ERROR_TEXT: Record<ApiError, string> = {
  NO_KEY: "YouTube API key is missing. Add YOUTUBE_API_KEY to the server environment and redeploy.",
  QUOTA: "Today's YouTube search quota is used up. Picks you already loaded still work, and new searches come back tomorrow.",
  FAILED: "Couldn't reach YouTube. Check your connection and try again.",
};

type Results = Record<Lang, Map<string, Video[]>>;

export default function FocusTube() {
  const { ready, settings, setSettings, daily, addWatch, startVideo, extendToday, recent } = useAppStore();
  const [screen, setScreen] = useState<Screen>("home");
  const [lang, setLang] = useState<Lang>("ko");
  const [filter, setFilter] = useState("All");
  const [current, setCurrent] = useState<Video | null>(null);
  const [ended, setEnded] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [pending, setPending] = useState<Video | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const player = useRef<PlayerHandle>(null);

  const goalSec = settings.goalMin * 60 + (daily.bonusSec ?? 0);
  const pct = goalSec ? daily.watchedSec / goalSec : 0;
  const over = pct >= 1;
  const blocking = settings.mode === "focus" && over;

  /* ---------- toast ---------- */
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  /* ---------- limit checks (run on every watch-time change) ---------- */
  const flags = useRef({ date: "", warned80: false, notified100: false });
  useEffect(() => {
    if (!ready || !daily.date) return;
    const f = flags.current;
    if (f.date !== daily.date) Object.assign(f, { date: daily.date, warned80: pct >= 0.8, notified100: pct >= 1 });
    if (settings.mode === "free") return;
    if (pct >= 0.8 && pct < 1 && !f.warned80) { f.warned80 = true; say(`Over 80% of your goal · ${fmtHM(goalSec - daily.watchedSec)} left`); }
    if (pct >= 1 && !f.notified100) {
      f.notified100 = true;
      if (settings.mode === "focus") { player.current?.pause(); setLimitOpen(true); }
      else say("You've reached today's goal");
    }
    if (pct < 1) f.notified100 = false;
  }, [ready, daily.date, daily.watchedSec, pct, goalSec, settings.mode, say]);

  /* ---------- YouTube results ---------- */
  const [results, setResults] = useState<Results>({ ko: new Map(), en: new Map() });
  const [loading, setLoading] = useState<Record<Lang, boolean>>({ ko: false, en: false });
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const tags = useMemo(() => searchTags(settings), [settings]);
  const tagsKey = tags.map((t) => `${t.name}=${t.keywords.ko}|${t.keywords.en}`).join(";");

  useEffect(() => { if (ready) pruneCache(); }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const l = lang;
    const missing = tags.filter((t) => !results[l].has(t.name));
    if (!missing.length) return;
    setLoading((s) => ({ ...s, [l]: true }));
    (async () => {
      const next = new Map(results[l]);
      for (const t of missing) {
        try {
          next.set(t.name, await searchCached(t.keywords[l] || t.name, l));
        } catch (e) {
          if (alive) setApiError(e instanceof SearchFailed ? e.code : "FAILED");
          break;
        }
      }
      if (!alive) return;
      setResults((r) => ({ ...r, [l]: next }));
      setLoading((s) => ({ ...s, [l]: false }));
    })();
    return () => { alive = false; setLoading((s) => ({ ...s, [l]: false })); };
    // results is read, not tracked: re-running on each result would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, lang, tagsKey]);

  /* ---------- actions ---------- */
  const go = (s: Screen) => { setScreen(s); document.getElementById("view")?.scrollTo(0, 0); };
  const openVideo = (v: Video) => {
    if (blocking) { setPending(v); setLimitOpen(true); return; }
    if (current?.id !== v.id) startVideo(v);
    setCurrent(v); setEnded(false); go("video");
  };
  const update = (fn: (s: Settings) => Settings) => setSettings((s) => fn(structuredClone(s)));
  /** New tags search for their own name in both languages until keywords are edited in Settings. */
  const addTag = (raw: string): boolean => {
    const n = raw.trim();
    if (!n) return false;
    if (settings.tags.some((t) => t.name.toLowerCase() === n.toLowerCase())) { say(`“${n}” already exists`); return false; }
    update((s) => {
      const i = s.tags.findIndex((t) => t.policy === "block");
      s.tags.splice(i < 0 ? s.tags.length : i, 0, { name: n, policy: "allow", priority: "mid", keywords: { ko: n, en: n }, custom: true });
      return s;
    });
    say(`Added “${n}”`);
    return true;
  };

  if (!ready) return <div className="h-dvh bg-zinc-50 dark:bg-zinc-900" />;

  /* ---------- views ---------- */
  const home = () => {
    const chipTags = ["All", ...tags.map((t) => t.name)];
    const active = chipTags.includes(filter) ? filter : "All";
    const listFor = (l: Lang) => {
      if (active === "All") return buildPicks(results[l], settings);
      const t = tags.find((x) => x.name === active)!;
      return tagVideos(t, results[l], settings);
    };
    const shown = listFor(lang);
    const loaded = (l: Lang) => tags.every((t) => results[l].has(t.name));
    return (
      <>
        {blocking && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-[13px] text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
            <b>You&apos;ve reached today&apos;s goal.</b> Opening a new video asks you to choose extra time first.
          </div>
        )}
        <Section className="lg:gap-4">
          <h1 className="text-base font-semibold tracking-tight lg:text-2xl lg:font-bold">Today&apos;s picks</h1>
          <div className="no-bar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 lg:mx-0 lg:flex-wrap lg:px-0">
            {chipTags.map((t) => (
              <button key={t} aria-pressed={active === t} onClick={() => setFilter(t)} className={cx(C.chip, C.focus)}>{t}</button>
            ))}
            <button onClick={() => setAddOpen((o) => !o)} aria-expanded={addOpen} className={cx("inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-emerald-600 px-3 py-1 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950", C.focus)}>
              <Icon name="add" className="text-base" />Tag
            </button>
          </div>
          {addOpen && (
            <form className="flex gap-2 lg:max-w-md" onSubmit={(e) => { e.preventDefault(); if (addTag(newTag)) { setFilter(newTag.trim()); setNewTag(""); setAddOpen(false); } }}>
              <input autoFocus value={newTag} onChange={(e) => setNewTag(e.target.value)} maxLength={24} placeholder="New tag (e.g. Cooking, Travel)" aria-label="New tag name" className={C.input} />
              <button className={C.btn} type="submit">Add</button>
            </form>
          )}
          <LangTabs lang={lang} onChange={setLang} count={(l) => (loaded(l) ? listFor(l).length : null)} />
          {apiError && <p className={C.note}>{ERROR_TEXT[apiError]}</p>}
          {shown.length ? <VideoGrid videos={shown} onOpen={openVideo} />
            : loading[lang] ? <SkeletonGrid />
            : !apiError && <p className={C.note}>No {LANGS[lang]} videos for “{active}” right now. Try different keywords for this tag in Settings.</p>}
        </Section>
        {recent.length > 0 && (
          <Section className="gap-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className={C.h}>Recently watched</h2>
              <span className={cx("tnum text-[12.5px]", C.muted)}>{daily.count} today</span>
            </div>
            <div className="no-bar -mx-4 flex gap-2.5 overflow-x-auto px-4 lg:mx-0 lg:gap-5 lg:px-0">
              {recent.map((v) => (
                <button key={v.id} onClick={() => openVideo(v)} className={cx("w-[140px] shrink-0 text-left lg:w-[220px]", C.focus)}>
                  <Thumb v={v} className="mb-2" />
                  <div className="line-clamp-2 text-xs font-semibold leading-snug lg:text-sm">{v.title}</div>
                </button>
              ))}
            </div>
          </Section>
        )}
      </>
    );
  };

  const video = () => {
    if (!current) return null;
    const v = current;
    const fb = settings.feedback[v.id];
    const chBlocked = settings.blockedChannels.some((c) => c.id === v.channelId);
    const buttons: [string, string, boolean, () => void][] = [
      ["thumb_up", "Useful", fb === "good", () => update((s) => {
        const on = s.feedback[v.id] !== "good";
        if (on) { s.feedback[v.id] = "good"; if (!s.usefulChannels.includes(v.channelId)) s.usefulChannels.push(v.channelId); say("We'll show more from this channel"); }
        else { delete s.feedback[v.id]; s.usefulChannels = s.usefulChannels.filter((c) => c !== v.channelId); }
        return s;
      })],
      ["thumb_down", "Not interested", fb === "no", () => update((s) => {
        if (s.feedback[v.id] === "no") delete s.feedback[v.id]; else { s.feedback[v.id] = "no"; say("Removed from your picks"); }
        return s;
      })],
      ["block", "Don't recommend this channel", chBlocked, () => update((s) => {
        if (chBlocked) s.blockedChannels = s.blockedChannels.filter((c) => c.id !== v.channelId);
        else { s.blockedChannels.push({ id: v.channelId, name: v.channel }); say(`Removed “${v.channel}” from your picks`); }
        return s;
      })],
    ];
    return (
      <div className="flex max-w-4xl flex-col gap-5">
        <button onClick={() => go("home")} className={cx(C.link, "inline-flex items-center gap-1 self-start", C.focus)}><Icon name="arrow_back" className="text-lg" />Back</button>
        <Player ref={player} videoId={v.id} onTick={addWatch} onEnded={() => setEnded(true)}
          onPlay={() => { if (blocking) { setLimitOpen(true); return false; } setEnded(false); return true; }} />
        <div>
          <h1 className="text-base font-semibold leading-snug tracking-tight lg:text-xl lg:font-bold">{v.title}</h1>
          <div className={cx("mt-1 text-[13px]", C.muted)}>{v.channel}</div>
        </div>
        {ended && (
          <div className="flex flex-col gap-2.5 rounded-xl bg-emerald-50 p-3.5 dark:bg-emerald-950/50">
            <p className="text-[13.5px]"><b>Video ended.</b> Autoplay is off, so you choose what&apos;s next.</p>
            <div className="flex flex-wrap gap-2">
              <button className={C.btn} onClick={() => go("home")}>Back to picks</button>
              <button className={C.ghost} onClick={() => { setCurrent(null); go("home"); say("Done for today. See you tomorrow"); }}>Done for today</button>
            </div>
          </div>
        )}
        <Section className="gap-2">
          <span className={C.label}>How was this video?</span>
          <div className="flex flex-wrap gap-1.5">
            {buttons.map(([icon, label, on, act]) => (
              <button key={label} aria-pressed={on} onClick={act} className={cx(C.chip, "inline-flex items-center gap-1.5", C.focus)}>
                <Icon name={icon} fill={on} className="text-[17px]" />{label}
              </button>
            ))}
          </div>
        </Section>
      </div>
    );
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-none flex-col gap-6 border-r border-zinc-200 bg-white px-5 py-6 dark:border-zinc-800 dark:bg-zinc-950 lg:flex">
        <span className="text-lg font-bold tracking-tight">FocusTube</span>
        <nav className="flex flex-col gap-1">
          {NAV.map(([k, label, icon]) => (
            <button key={k} onClick={() => go(k)} aria-current={screen === k ? "page" : undefined}
              className={cx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium", C.focus,
                screen === k ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900")}>
              <Icon name={icon} fill={screen === k} className="text-[22px]" />{label}
            </button>
          ))}
        </nav>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <Meter compact watched={daily.watchedSec} goal={goalSec} mode={settings.mode} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone meter */}
        <header className="flex-none border-b border-zinc-200 bg-white px-4 pb-3 dark:border-zinc-800 dark:bg-zinc-950 lg:hidden" style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))" }}>
          <Meter watched={daily.watchedSec} goal={goalSec} mode={settings.mode} />
        </header>

        <main id="view" className="no-bar min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-8 pt-4 lg:gap-8 lg:px-10 lg:py-8"
            style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
            {screen === "home" && home()}
            {screen === "search" && <SearchView settings={settings} onOpen={openVideo} />}
            {screen === "settings" && <SettingsView settings={settings} update={update} say={say} addTag={addTag} />}
            {screen === "video" && video()}
          </div>
        </main>

        {/* Phone tab bar */}
        {screen !== "video" && (
          <nav className="grid flex-none grid-cols-3 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            {NAV.map(([k, label, icon]) => (
              <button key={k} onClick={() => go(k)} aria-current={screen === k ? "page" : undefined}
                className={cx("flex flex-col items-center gap-0.5 pb-2.5 pt-2 text-xs", C.focus, screen === k ? "font-semibold text-zinc-900 dark:text-zinc-100" : C.muted)}>
                <Icon name={icon} fill={screen === k} className="text-[26px]" />{label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {limitOpen && (
        <LimitDialog watched={daily.watchedSec} count={daily.count}
          onEnd={() => { setLimitOpen(false); setPending(null); player.current?.pause(); setCurrent(null); go("home"); say("Done for today. See you tomorrow"); }}
          onExtend={(m) => {
            extendToday(m, settings.goalMin * 60);
            flags.current.warned80 = true;
            setLimitOpen(false);
            if (pending) { const v = pending; setPending(null); if (current?.id !== v.id) startVideo(v); setCurrent(v); setEnded(false); go("video"); }
            say("Extra time added for today. We'll check in again when it runs out");
          }} />
      )}

      <div role="status" aria-live="polite"
        className={cx("pointer-events-none fixed left-1/2 top-[calc(140px+env(safe-area-inset-top,0px))] z-30 w-[calc(100%-28px)] max-w-sm -translate-x-1/2 rounded-xl bg-zinc-900 px-3.5 py-2.5 text-[13.5px] text-white shadow-lg transition dark:bg-zinc-100 dark:text-zinc-900 lg:bottom-6 lg:top-auto lg:w-auto",
          toast ? "opacity-100" : "opacity-0")}>{toast}</div>
    </div>
  );
}

/* ---------- meter ---------- */
function Meter({ watched, goal, mode, compact }: { watched: number; goal: number; mode: Mode; compact?: boolean }) {
  const pct = goal ? watched / goal : 0, over = pct >= 1, warn = !over && pct >= 0.8;
  const pill = over ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" : warn ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400";
  const bar = over ? "bg-red-600 dark:bg-red-500" : warn ? "bg-amber-500" : "bg-emerald-600 dark:bg-emerald-500";
  const strong = "font-semibold text-zinc-900 dark:text-zinc-100";
  const pillEl = <span className={cx("self-start rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", pill)}>{MODES[mode].name} mode{over ? " · Goal reached" : warn ? " · Over 80%" : ""}</span>;
  const barEl = (
    <div className="relative mt-2.5 h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Daily goal">
      <i className={cx("absolute inset-y-0 left-0 rounded transition-[width] duration-500", bar)} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      <b className="absolute inset-y-0 left-[80%] w-0.5 bg-white dark:bg-zinc-950" />
    </div>
  );
  const left = over ? <><strong className={strong}>{fmtHM(watched - goal)}</strong> over</> : <><strong className={strong}>{fmtHM(goal - watched)}</strong> left</>;
  if (compact) return (
    <div className="flex flex-col">
      <span className={cx(C.label, "inline-flex items-center gap-1.5")}><Icon name="schedule" className="text-base" />Watched today</span>
      <div className="tnum mt-1 text-[26px] font-bold leading-tight tracking-tight">{fmtClock(watched)}</div>
      {barEl}
      <div className={cx("tnum mt-1.5 flex justify-between text-xs", C.muted)}><span>Goal <strong className={strong}>{fmtHM(goal)}</strong></span><span>{left}</span></div>
      <div className="mt-3">{pillEl}</div>
    </div>
  );
  return (
    <>
      <div className="flex items-center justify-between gap-2"><span className="text-[15px] font-bold tracking-tight">FocusTube</span>{pillEl}</div>
      <div className="tnum mt-2 text-[30px] font-bold leading-none tracking-tight">{fmtClock(watched)}<span className={cx("ml-2 text-[13px] font-medium tracking-normal", C.muted)}>watched today</span></div>
      {barEl}
      <div className={cx("tnum mt-1.5 flex justify-between text-[12.5px]", C.muted)}><span>Goal <strong className={strong}>{fmtHM(goal)}</strong> · {Math.min(999, Math.round(pct * 100))}%</span><span>{left}</span></div>
    </>
  );
}

/* ---------- search ---------- */
function SearchView({ settings, onOpen }: { settings: Settings; onOpen: (v: Video) => void }) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<Lang>("ko");
  const [res, setRes] = useState<Partial<Record<Lang, Video[]>>>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || q === query) return;
    setQuery(q); setRes({}); setError(null); setBusy(true);
    // Both languages at once so the tab counts compare Korean vs English results.
    const out: Partial<Record<Lang, Video[]>> = {};
    for (const l of ["ko", "en"] as Lang[]) {
      try { out[l] = await searchCached(q, l); setRes({ ...out }); }
      catch (err) { setError(err instanceof SearchFailed ? err.code : "FAILED"); break; }
    }
    setBusy(false);
  };
  const visible = (l: Lang) => res[l]?.filter((v) => !hiddenReason(v, settings)) ?? null;
  const shown = visible(lang);

  return (
    <>
      <form onSubmit={submit} className="flex gap-2 lg:max-w-xl">
        <input value={text} onChange={(e) => setText(e.target.value)} type="search" enterKeyHint="search" placeholder="Search YouTube" aria-label="Search" className={C.input} />
        <button className={C.btn} type="submit" aria-label="Search"><Icon name="search" className="text-xl" /></button>
      </form>
      {query && (
        <Section className="lg:gap-5">
          <LangTabs lang={lang} onChange={setLang} count={(l) => visible(l)?.length ?? null} />
          {error && <p className={C.note}>{ERROR_TEXT[error]}</p>}
          {shown ? (shown.length ? <VideoGrid videos={shown} onOpen={onOpen} /> : <p className={cx("text-sm", C.muted)}>No results</p>)
            : busy && <SkeletonGrid n={4} />}
        </Section>
      )}
    </>
  );
}

/* ---------- settings ---------- */
const polClass = (p: Policy) => p === "allow" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
  : p === "limited" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";

function SettingsView({ settings, update, say, addTag: add }: { settings: Settings; update: (fn: (s: Settings) => Settings) => void; say: (m: string) => void; addTag: (n: string) => boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");

  const cycle = (t: Tag) => {
    const order: Policy[] = t.system ? ["allow", "block"] : ["allow", "limited", "block"];
    return order[(order.indexOf(t.policy) + 1) % order.length];
  };
  const addTag = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (add(n)) { setName(""); setOpen(n); }
  };

  return (
    <div className="flex flex-col gap-6 lg:max-w-2xl">
      <h1 className="hidden text-2xl font-bold tracking-tight lg:block">Settings</h1>

      <Section className="gap-2.5">
        <span className={C.label}>Daily watch goal</span>
        <div className={C.card}><div className="flex flex-col gap-2 px-3.5 py-3">
          <div className="flex items-baseline justify-between text-sm"><span>Daily max</span><span className="tnum text-lg font-bold">{fmtHM(settings.goalMin * 60)}</span></div>
          <input type="range" min={30} max={300} step={10} value={settings.goalMin} aria-label="Daily goal in minutes"
            onChange={(e) => update((s) => ({ ...s, goalMin: Number(e.target.value) }))} className="w-full accent-emerald-600" />
          <span className={cx("text-xs", C.muted)}>We alert you at 80% and 100%. Counts actual playback in FocusTube, not time in the app or in other YouTube apps.</span>
        </div></div>
      </Section>

      <Section className="gap-2.5">
        <span className={C.label}>Limit mode</span>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(MODES) as Mode[]).map((k) => (
            <button key={k} aria-pressed={settings.mode === k} onClick={() => update((s) => ({ ...s, mode: k }))}
              className={cx("rounded-lg border bg-white px-2.5 py-2.5 text-left text-xs dark:bg-zinc-800", C.muted, C.focus,
                settings.mode === k ? "border-emerald-600 ring-1 ring-emerald-600 dark:border-emerald-500 dark:ring-emerald-500" : "border-zinc-200 dark:border-zinc-700")}>
              <strong className="mb-0.5 block text-sm text-zinc-900 dark:text-zinc-100">{MODES[k].name}</strong>{MODES[k].desc}
            </button>
          ))}
        </div>
      </Section>

      <Section className="gap-2.5">
        <span className={C.label}>Tags · tap a policy to change it</span>
        <div className={C.card}>
          {settings.tags.map((t, i) => (
            <div key={t.name} className="px-3.5 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2.5">
                <button className={cx("min-w-0 text-left", C.focus)} disabled={!!t.system} onClick={() => setOpen(open === t.name ? null : t.name)} aria-expanded={open === t.name}>
                  <span className="inline-flex items-center gap-1">{t.name}{!t.system && <Icon name={open === t.name ? "expand_less" : "expand_more"} className={cx("text-lg", C.muted)} />}</span>
                  <div className={cx("text-xs", C.muted)}>
                    {t.system ? (t.policy === "block" ? `Hides videos ${SHORTS_MAX_SEC / 60} min or shorter` : "Shorts can appear") : t.policy === "block" ? "Hidden from picks and search" : `${PRIORITY_LABEL[t.priority]} priority`}
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  {t.custom && (
                    <button aria-label={`Delete ${t.name}`} onClick={() => { update((s) => ({ ...s, tags: s.tags.filter((x) => x.name !== t.name) })); say(`Deleted “${t.name}”`); }}
                      className={cx("rounded p-1 text-zinc-500 hover:text-red-600 dark:text-zinc-400", C.focus)}><Icon name="delete" className="text-xl" /></button>
                  )}
                  <button onClick={() => update((s) => { s.tags[i].policy = cycle(t); return s; })} className={cx("min-w-[72px] rounded-md px-2.5 py-1 text-xs font-semibold", polClass(t.policy), C.focus)}>{POLICY_LABEL[t.policy]}</button>
                </div>
              </div>
              {open === t.name && !t.system && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(["ko", "en"] as Lang[]).map((l) => (
                    <label key={l} className="flex flex-col gap-1 text-xs">
                      <span className={C.muted}>{LANGS[l]} search keyword</span>
                      <input className={C.input} defaultValue={t.keywords[l]}
                        onBlur={(e) => { const val = e.target.value.trim() || t.name; if (val !== t.keywords[l]) update((s) => { s.tags[i].keywords[l] = val; return s; }); }} />
                    </label>
                  ))}
                  {t.policy !== "block" && (
                    <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                      <span className={C.muted}>Priority</span>
                      <div className="flex gap-1.5">
                        {(["high", "mid", "low"] as const).map((p) => (
                          <button key={p} aria-pressed={t.priority === p} onClick={() => update((s) => { s.tags[i].priority = p; return s; })} className={cx(C.chip, C.focus)}>{PRIORITY_LABEL[p]}</button>
                        ))}
                      </div>
                    </label>
                  )}
                </div>
              )}
            </div>
          ))}
          <form onSubmit={addTag} className="flex gap-2 px-3.5 py-2.5">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="New tag (e.g. Cooking, Investing)" aria-label="New tag name" className={C.input} />
            <button className={C.btn} type="submit"><Icon name="add" className="text-lg" />Add</button>
          </form>
        </div>
      </Section>

      <Section className="gap-2.5">
        <span className={C.label}>Blocked channels</span>
        <div className={C.card}>
          {settings.blockedChannels.length ? settings.blockedChannels.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-3.5 py-2.5 text-sm">{c.name}
              <button className={cx(C.link, C.focus)} onClick={() => update((s) => ({ ...s, blockedChannels: s.blockedChannels.filter((x) => x.id !== c.id) }))}>Unblock</button>
            </div>
          )) : <div className={cx("px-3.5 py-2.5 text-xs", C.muted)}>Tap “Don&apos;t recommend this channel” on a video to add one here.</div>}
        </div>
      </Section>

      <p className={cx("text-xs leading-relaxed", C.muted)}>
        FocusTube uses YouTube API Services. Videos and data come from YouTube. See the{" "}
        <a className="underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms of Service</a> and{" "}
        <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a>.
        Your settings and watch history stay on this device.
      </p>
    </div>
  );
}

/* ---------- limit dialog ---------- */
function LimitDialog({ watched, count, onEnd, onExtend }: { watched: number; count: number; onEnd: () => void; onExtend: (min: number) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-zinc-950/50 lg:items-center lg:justify-center lg:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="limit-title"
        className="flex w-full flex-col gap-3.5 rounded-t-2xl bg-white px-5 pt-5 shadow-xl dark:bg-zinc-900 lg:max-w-[420px] lg:rounded-2xl lg:p-6"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
        <Icon name="hourglass_bottom" className="text-[30px] text-amber-600 dark:text-amber-400" />
        <h2 id="limit-title" className="text-xl font-bold tracking-tight">You&apos;ve reached today&apos;s watch goal</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className={cx("rounded-lg bg-zinc-100 px-3 py-2.5 text-xs dark:bg-zinc-800", C.muted)}><strong className="tnum block text-xl text-zinc-900 dark:text-zinc-100">{Math.round(watched / 60)} min</strong>watched today</div>
          <div className={cx("rounded-lg bg-zinc-100 px-3 py-2.5 text-xs dark:bg-zinc-800", C.muted)}><strong className="tnum block text-xl text-zinc-900 dark:text-zinc-100">{count}</strong>videos watched</div>
        </div>
        <p className={cx("text-sm", C.muted)}>End for today, or choose how much more you want to watch.</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[10, 20, 30].map((m) => (
            <button key={m} aria-pressed={pick === m} onClick={() => setPick(m)}
              className={cx("rounded-lg border py-2.5 text-sm font-semibold", C.focus, pick === m ? "border-amber-500 text-amber-700 ring-1 ring-amber-500 dark:text-amber-400" : "border-zinc-200 dark:border-zinc-700")}>+{m} min</button>
          ))}
        </div>
        <button className={cx(C.btn, "w-full")} onClick={onEnd}>End for today</button>
        <button className={cx(C.ghost, "w-full")} disabled={!pick} onClick={() => pick && onExtend(pick)}>{pick ? `Watch ${pick} more min` : "Choose extra time first"}</button>
      </div>
    </div>
  );
}
