import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const signedUrlCache = new Map<string, { expiresAt: number; url: string }>();

export function useSignedPhotoUrl(photoPath: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoPath) {
      setUrl(null);
      return;
    }

    const cached = signedUrlCache.get(photoPath);
    if (cached && cached.expiresAt > Date.now()) {
      setUrl(cached.url);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setUrl(null);
      return;
    }

    let active = true;
    void supabase.storage.from("shop-photos").createSignedUrl(photoPath, 60 * 60).then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (!error && data?.signedUrl) {
        signedUrlCache.set(photoPath, { expiresAt: Date.now() + 50 * 60 * 1000, url: data.signedUrl });
        setUrl(data.signedUrl);
      } else {
        setUrl(null);
      }
    });

    return () => {
      active = false;
    };
  }, [photoPath]);

  return url;
}
