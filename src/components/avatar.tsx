import Image from 'next/image';

interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
}

// Round avatar: the photo when there is one, otherwise the name's first
// letter on a soft tint. `uri` is always a resolved https signed URL (never
// a local blob: preview — see photo-picker.tsx for that case), so
// next/image can always optimize it: resized to exactly `size`, served as
// AVIF/WebP, lazy-loaded off-screen. This appears in lists (Shops,
// Operations, Members, Riders), so it's the single highest-traffic image
// spot in the app.
export function Avatar({ name, uri, size = 44 }: AvatarProps) {
  const dim = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        src={uri}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: size / 2 }}
        className="shrink-0 object-cover"
        unoptimized={!uri.startsWith('https://')}
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      style={{ ...dim, fontSize: Math.round(size * 0.42) }}
      className="flex shrink-0 items-center justify-center bg-primary-soft font-bold text-primary">
      {initial}
    </div>
  );
}
