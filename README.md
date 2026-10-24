# FocusTube

Watch YouTube on your terms: your topics, your daily time limit.
Personal MVP built from PRD v0.1. Works in desktop browsers and installs on iPhone as a home-screen web app (PWA).

## Stack
- Next.js 15 (App Router) · React 19 · Tailwind CSS 3.4
- Inter + Noto Sans KR (Korean fallback) · Material Symbols Rounded (weight 200)
- YouTube Data API v3 (search, server-side only) · YouTube IFrame Player API (playback)
- All settings and watch history live in the browser's localStorage. No account, no database.

## Deploy to Vercel
1. Import this repository at vercel.com/new.
2. Add an environment variable: `YOUTUBE_API_KEY` = your YouTube Data API v3 key.
3. Deploy. Open the URL on iPhone Safari → Share → **Add to Home Screen**.

## Run locally
```bash
npm install
cp .env.example .env.local   # paste your key
npm run dev
```
Set `YOUTUBE_MOCK=1` instead of a key to use sample results without spending quota.

## How the quota is used
- Each tag searches once per language per day (results are cached on the device until midnight and on the server for 6 hours).
- A manual search costs two searches (Korean + English).
- Check your project's current limits in Google Cloud Console → APIs & Services → YouTube Data API v3 → Quotas.

## Known limits
- Shorts are detected by length (3 min or shorter, or `#shorts` in the title). The API has no explicit Shorts flag.
- Korean/English tabs combine `relevanceLanguage`, the title's script (Hangul or not) and the video's declared language. Some videos may still land in the wrong tab.
- Only playback inside FocusTube is counted. Time in the YouTube app or other sites is not.
- The YouTube player's own end screen can still show suggestions; FocusTube does not modify the player (YouTube API Developer Policies).

## Before sharing with other people
Read the YouTube API Services Developer Policies: you will need a privacy policy, terms that reference YouTube's Terms of Service, YouTube branding, and a compliance audit for more quota. Check whether the focus-mode block fits policy III.F.3 before a public launch.
