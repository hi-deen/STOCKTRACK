/* eslint-disable @next/next/no-img-element */
interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
}

// Round avatar: the photo when there is one, otherwise the name's first
// letter on a soft tint.
export function Avatar({ name, uri, size = 44 }: AvatarProps) {
  const dim = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <img src={uri} alt="" style={dim} className="shrink-0 object-cover" />;
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
