import { uploadPhotoToStorage, type LocalPhoto } from '@/lib/upload-photo';

// Path convention matches the delivery-proofs storage policy, which checks
// split_part(name, '/', 1) against the caller's business_id.
export async function uploadDeliveryProofPhoto(
  localUri: LocalPhoto,
  businessId: string,
  shopId: string
): Promise<string> {
  const path = `${businessId}/${shopId}/${Date.now()}.jpg`;
  return uploadPhotoToStorage('delivery-proofs', path, localUri);
}
