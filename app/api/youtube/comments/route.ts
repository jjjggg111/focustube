import { NextResponse, type NextRequest } from "next/server";
import { fetchComments, YouTubeError } from "@/lib/youtube";

const VIDEO_ID = /^[\w-]{11}$/;

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId") ?? "";
  if (!VIDEO_ID.test(videoId) && !videoId.startsWith("mock-")) {
    return NextResponse.json({ error: "FAILED", message: "videoId is required" }, { status: 400 });
  }
  try {
    const body = await fetchComments(videoId);
    return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (e) {
    const code = e instanceof YouTubeError ? e.code : "FAILED";
    console.error("[youtube/comments]", e);
    return NextResponse.json({ error: code }, { status: code === "QUOTA" ? 429 : code === "NO_KEY" ? 503 : 502 });
  }
}
