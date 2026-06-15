import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const errorDescription = requestUrl.searchParams.get("error_description") ?? "Authentication failed";

  if (!code) {
    const loginUrl = new URL("/login", requestUrl);
    loginUrl.searchParams.set("message", errorDescription);
    return NextResponse.redirect(loginUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const loginUrl = new URL("/login", requestUrl);
    loginUrl.searchParams.set("message", "Supabase is not configured");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user) {
    const loginUrl = new URL("/login", requestUrl);
    loginUrl.searchParams.set("message", "This link is invalid or has expired.");
    return NextResponse.redirect(loginUrl);
  }

  const { count } = await supabase.from("business_members").select("id", { count: "exact", head: true });
  const redirectTo = count ? "/dashboard/operations" : "/onboarding";

  const redirectUrl = new URL(redirectTo, requestUrl);
  return NextResponse.redirect(redirectUrl);
}
