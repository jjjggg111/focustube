import { NextResponse, type NextRequest } from "next/server";
import { searchVideos, YouTubeError } from "@/lib/youtube";
import type { Lang } from "@/lib/types";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 100);
  const lang = req.nextUrl.searchParams.get("lang") as Lang | null;
  if (!q || (lang !== "ko" && lang !== "en")) {
    return NextResponse.json({ error: "FAILED", message: "q and lang (ko|en) are required" }, { status: 400 });
  }
  try {
    const videos = await searchVideos(q, lang);
    return NextResponse.json({ videos }, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (e) {
    const code = e instanceof YouTubeError ? e.code : "FAILED";
    console.error("[youtube/search]", e);
    return NextResponse.json({ error: code }, { status: code === "QUOTA" ? 429 : code === "NO_KEY" ? 503 : 502 });
  }
}
