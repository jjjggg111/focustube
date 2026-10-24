"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

declare global {
  interface Window { onYouTubeIframeAPIReady?: () => void }
}

let apiReady: Promise<void> | null = null;
function loadIframeApi(): Promise<void> {
  if (typeof window !== "undefined" && window.YT?.Player) return Promise.resolve();
  if (!apiReady) {
    apiReady = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return apiReady;
}

export type PlayerHandle = { pause: () => void };

type Props = {
  videoId: string;
  /** Called about once a second with seconds of actual playback. */
  onTick: (sec: number) => void;
  /** Return false to stop playback from starting (focus mode over the goal). */
  onPlay: () => boolean;
  onEnded: () => void;
};

/**
 * The official YouTube IFrame player, unmodified (YouTube API Developer Policies III.I).
 * Watch time is measured by polling the player state, so only real playback counts.
 */
export const Player = forwardRef<PlayerHandle, Props>(function Player({ videoId, onTick, onPlay, onEnded }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YT.Player | null>(null);
  const cb = useRef({ onTick, onPlay, onEnded });
  cb.current = { onTick, onPlay, onEnded };

  useImperativeHandle(ref, () => ({ pause: () => player.current?.pauseVideo?.() }), []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const mount = document.createElement("div");
    host.current?.appendChild(mount);

    loadIframeApi().then(() => {
      if (cancelled) return;
      player.current = new YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, autoplay: 1, origin: window.location.origin },
        events: {
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING && !cb.current.onPlay()) e.target.pauseVideo();
            if (e.data === YT.PlayerState.ENDED) cb.current.onEnded();
          },
        },
      });
      let last = performance.now();
      timer = setInterval(() => {
        const now = performance.now();
        const dt = Math.min(2, (now - last) / 1000);
        last = now;
        if (player.current?.getPlayerState?.() === YT.PlayerState.PLAYING) cb.current.onTick(dt);
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      player.current?.destroy?.();
      player.current = null;
      if (host.current) host.current.innerHTML = "";
    };
  }, [videoId]);

  return <div ref={host} className="aspect-video w-full overflow-hidden rounded-xl bg-black [&_iframe]:h-full [&_iframe]:w-full" />;
});
