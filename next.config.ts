import type { NextConfig } from "next";

// Derived from the env var rather than hardcoded, so this stays correct if
// the Supabase project ever changes without anyone remembering to update a
// second place. Falls back to a wildcard so a build without the env var set
// (e.g. a first-time checkout) doesn't hard-fail.
function supabaseImageHostname(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "*.supabase.co";
  try {
    return new URL(url).hostname;
  } catch {
    return "*.supabase.co";
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compiler: {
    // Strips console.* calls from production client bundles (errors/warnings
    // kept) — smaller bundle, no console overhead on low-end devices.
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    // Applies Next's per-import tree-shaking/chunking heuristics to
    // lucide-react so an icon that isn't rendered on a given route never
    // ships in that route's chunk, even transitively.
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    // Shop/delivery/member photos come from Supabase Storage signed URLs —
    // this lets next/image resize, lazy-load and serve them as
    // AVIF/WebP instead of shipping the original upload to every device.
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHostname(),
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
};

export default nextConfig;
