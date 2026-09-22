import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

// The browser's service-worker update check compares this file's BYTES
// between visits — if they're identical to what it already has, it decides
// there's nothing new, no matter how much the rest of the app changed.
// Serving it from public/ as a static file meant most deploys (which don't
// touch the worker's own logic) never changed those bytes at all, so
// UpdateAvailable.tsx would never fire for a typical deploy. Serving it
// from a Route Handler instead lets a real build-time value get stamped
// into the file's content, guaranteeing it changes exactly once per actual
// deploy — see sw.template.js for the worker logic itself.
function resolveBuildStamp(): string {
  const envSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    process.env.SOURCE_VERSION;
  if (envSha) return envSha.slice(0, 12);
  return String(Date.now());
}

// Computed once, when this module is evaluated. For a production build
// that happens at build time (this route has no dynamic APIs, so Next
// renders it once and caches the result — see `dynamic` below), which is
// exactly the "once per deploy" granularity this needs.
const BUILD_STAMP = resolveBuildStamp();

const TEMPLATE_PATH = path.join(process.cwd(), "src", "service-worker", "sw.template.js");

export const dynamic = "force-static";

export function GET() {
  const template = readFileSync(TEMPLATE_PATH, "utf8");
  const body = template.replaceAll("__BUILD_ID__", BUILD_STAMP);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
