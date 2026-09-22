import imageCompression from 'browser-image-compression';

import { supabase } from '@/lib/supabase';

// Longest edge, not a flat width/height, matching the mobile app's rule.
const MAX_DIMENSION = 1600;

// On the web a "local photo" is a File picked from an <input type="file">.
export type LocalPhoto = File | Blob;

async function compressPhoto(photo: LocalPhoto): Promise<Blob> {
  const asFile =
    photo instanceof File ? photo : new File([photo], 'photo.jpg', { type: photo.type || 'image/jpeg' });
  return imageCompression(asFile, {
    maxWidthOrHeight: MAX_DIMENSION,
    initialQuality: 0.6,
    fileType: 'image/jpeg',
    useWebWorker: true,
  });
}

export async function uploadPhotoToStorage(
  bucket: string,
  path: string,
  photo: LocalPhoto
): Promise<string> {
  const compressed = await compressPhoto(photo);
  const { error } = await supabase.storage.from(bucket).upload(path, compressed, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

// Both shop-photos and delivery-proofs are private buckets, so displaying an
// already-uploaded photo needs a signed URL rather than a public one.
export async function getSignedPhotoUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

// Signed links are reused until within 10 minutes of expiring so thumbnails
// keep their browser-cached image across refreshes.
const REFRESH_MARGIN_MS = 10 * 60 * 1000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}

export async function getSignedPhotoUrls(
  bucket: string,
  paths: string[],
  expiresInSeconds = 3600
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;

  const now = Date.now();
  const missing: string[] = [];
  for (const path of paths) {
    const cached = signedUrlCache.get(`${bucket}/${path}`);
    if (cached && cached.expiresAt - REFRESH_MARGIN_MS > now) {
      map.set(path, cached.url);
    } else {
      missing.push(path);
    }
  }
  if (missing.length === 0) return map;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(missing, expiresInSeconds);
  if (error || !data) return map;
  for (const row of data) {
    if (row.path && row.signedUrl) {
      map.set(row.path, row.signedUrl);
      signedUrlCache.set(`${bucket}/${row.path}`, {
        url: row.signedUrl,
        expiresAt: now + expiresInSeconds * 1000,
      });
    }
  }
  return map;
}
