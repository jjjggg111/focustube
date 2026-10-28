"use client";
import { useEffect } from "react";

/** Registers /sw.js in production only; in dev it would cache stale hot-reload chunks. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => { /* app works without it */ });
  }, []);
  return null;
}
