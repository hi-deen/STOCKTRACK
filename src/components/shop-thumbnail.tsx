import { Avatar } from '@/components/avatar';

interface ShopThumbnailProps {
  uri: string | null | undefined;
  name?: string;
  size?: number;
}

// Round shop avatar: photo when available, else the shop name's initial.
export function ShopThumbnail({ uri, name = '', size = 44 }: ShopThumbnailProps) {
  return <Avatar name={name} uri={uri} size={size} />;
}
