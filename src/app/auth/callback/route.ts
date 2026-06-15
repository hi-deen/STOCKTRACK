import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");

  if (!code) {
    const loginUrl = new URL("/login", requestUrl);
    loginUrl.searchParams.set("error", "link_expired");
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
    loginUrl.searchParams.set("error", "link_expired");
    return NextResponse.redirect(loginUrl);
  }

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/reset-password", requestUrl));
  }

  const { count } = await supabase.from("business_members").select("id", { count: "exact", head: true });
  const redirectTo = count ? "/dashboard/operations" : "/onboarding";

  return NextResponse.redirect(new URL(redirectTo, requestUrl));
}
