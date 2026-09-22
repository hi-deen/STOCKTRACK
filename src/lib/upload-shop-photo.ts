import { uploadPhotoToStorage, type LocalPhoto } from '@/lib/upload-photo';

// Same path convention as delivery-proofs: <business_id>/<shop_id>/<ts>.jpg,
// matching the shop-photos storage policy's business-folder scoping.
export async function uploadShopPhoto(
  localUri: LocalPhoto,
  businessId: string,
  shopId: string
): Promise<string> {
  const path = `${businessId}/${shopId}/${Date.now()}.jpg`;
  return uploadPhotoToStorage('shop-photos', path, localUri);
}
