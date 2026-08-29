import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  // Validate the session against the auth server before trusting it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    return NextResponse.json({ error: "No active session found." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the deletion service. Please try again." },
      { status: 502 },
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Fall through to a generic message below.
  }

  if (payload && typeof payload === "object") {
    return NextResponse.json(payload, { status: response.status });
  }

  return NextResponse.json(
    { error: "The deletion service returned an unexpected response." },
    { status: response.status || 502 },
  );
}
