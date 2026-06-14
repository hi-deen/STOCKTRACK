import { createClient } from "@/lib/supabase/client";

const signedUrlCache = new Map<string, { expiresAt: number; url: string }>();

export function useSignedPhotoUrl(photoPath: string | null | undefined) {
  const supabase = createClient();

  if (!photoPath || !supabase) {
    return null;
  }

  const cached = signedUrlCache.get(photoPath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  void supabase.storage.from("shop-photos").createSignedUrl(photoPath, 60 * 60).then(({ data, error }) => {
    if (!error && data?.signedUrl) {
      signedUrlCache.set(photoPath, { expiresAt: Date.now() + 50 * 60 * 1000, url: data.signedUrl });
    }
  });

  return null;
}
