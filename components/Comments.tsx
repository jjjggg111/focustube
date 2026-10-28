"use client";
import { useEffect, useState } from "react";
import type { ApiError, Comment } from "@/lib/types";
import { C, cx, fmtAgo, Icon, Section } from "./ui";

type State =
  | { status: "loading" }
  | { status: "error"; code: ApiError }
  | { status: "done"; comments: Comment[]; disabled: boolean };

const ERROR_TEXT: Record<ApiError, string> = {
  NO_KEY: "Comments need the YouTube API key on the server.",
  QUOTA: "Today's YouTube quota is used up, so comments are unavailable until tomorrow.",
  FAILED: "Couldn't load comments. Check your connection and try again.",
};

const count = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** Top YouTube comments for a video, read-only. Replies and posting stay on YouTube. */
export function Comments({ videoId }: { videoId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fetch(`/api/youtube/comments?${new URLSearchParams({ videoId })}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) setState({ status: "error", code: (body.error as ApiError) ?? "FAILED" });
        else setState({ status: "done", comments: body.comments ?? [], disabled: !!body.disabled });
      })
      .catch(() => alive && setState({ status: "error", code: "FAILED" }));
    return () => { alive = false; };
  }, [videoId]);

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return (
    <Section className="gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className={C.h}>Comments</h2>
        <a href={watchUrl} target="_blank" rel="noreferrer" className={cx(C.link, "text-[13px]", C.focus)}>Open on YouTube</a>
      </div>
      {state.status === "loading" && (
        <div className="flex flex-col gap-4" aria-label="Loading comments">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-1 flex-col gap-2 pt-1"><div className="h-3 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" /><div className="h-3 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" /></div>
            </div>
          ))}
        </div>
      )}
      {state.status === "error" && <p className={C.note}>{ERROR_TEXT[state.code]}</p>}
      {state.status === "done" && (state.disabled ? <p className={C.note}>Comments are turned off for this video.</p>
        : !state.comments.length ? <p className={cx("text-sm", C.muted)}>No comments yet.</p>
        : <ul className="flex flex-col gap-4">{state.comments.map((c) => <CommentRow key={c.id} c={c} />)}</ul>)}
    </Section>
  );
}

function CommentRow({ c }: { c: Comment }) {
  const [open, setOpen] = useState(false);
  const long = c.text.length > 220 || c.text.split("\n").length > 4;
  return (
    <li className="flex gap-3">
      {c.avatar
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={c.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        : <div aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-200 text-xs font-semibold dark:bg-zinc-800">{c.author.replace(/^@/, "").slice(0, 1).toUpperCase()}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1.5 text-[12.5px]">
          <span className="truncate font-semibold">{c.author}</span>
          <span className={cx("shrink-0", C.muted)}>{fmtAgo(c.publishedAt)}</span>
        </div>
        <p className={cx("mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed", !open && long && "line-clamp-4")}>{c.text}</p>
        {long && <button onClick={() => setOpen((o) => !o)} className={cx("mt-0.5 text-[12.5px] font-semibold", C.muted, C.focus)}>{open ? "Show less" : "Read more"}</button>}
        <div className={cx("tnum mt-1 flex items-center gap-3 text-xs", C.muted)}>
          <span className="inline-flex items-center gap-1"><Icon name="thumb_up" className="text-[15px]" />{c.likes ? count.format(c.likes) : ""}</span>
          {c.replies > 0 && <span>{c.replies} {c.replies === 1 ? "reply" : "replies"}</span>}
        </div>
      </div>
    </li>
  );
}
