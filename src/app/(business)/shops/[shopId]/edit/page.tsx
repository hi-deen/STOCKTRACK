'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PhotoPicker } from '@/components/photo-picker';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { EMPTY_SHOP_FORM, ShopFormFields, type ShopFormValues } from '@/components/shop-form-fields';
import { SkeletonRows } from '@/components/skeleton';
import { SwitchRow } from '@/components/switch-row';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { getShop, updateShop } from '@/lib/shops-api';
import { getSignedPhotoUrl } from '@/lib/upload-photo';
import { uploadShopPhoto } from '@/lib/upload-shop-photo';
import type { Shop } from '@/types/catalog';

export default function EditShopPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId } = useBusinessAuth();
  const { shopId } = useParams<{ shopId: string }>();

  const [shop, setShop] = useState<Shop | null>(null);
  const [values, setValues] = useState<ShopFormValues>(EMPTY_SHOP_FORM);
  const [isActive, setIsActive] = useState(true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!shopId || dirty) return;
    try {
      const data = await getShop(shopId);
      setShop(data);
      setValues({
        name: data.name,
        ownerName: data.owner_name ?? '',
        phone: data.phone ?? '',
        area: data.area ?? '',
        address: data.address ?? '',
        notes: data.notes ?? '',
      });
      setIsActive(data.is_active);
      if (data.photo_path) setExistingPhotoUrl(await getSignedPhotoUrl('shop-photos', data.photo_path));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load this shop.'));
    }
  }, [shopId, dirty]);

  useFocusEffect(load);

  const canSubmit = values.name.trim().length > 0 && !!activeBusinessId && !!shopId;

  async function handleSubmit() {
    if (!canSubmit || isSubmitting || !activeBusinessId || !shopId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const photoPath = photo ? await uploadShopPhoto(photo, activeBusinessId, shopId) : undefined;
      await updateShop(shopId, {
        name: values.name.trim(),
        owner_name: values.ownerName.trim() || null,
        phone: values.phone.trim() || null,
        area: values.area.trim() || null,
        address: values.address.trim() || null,
        notes: values.notes.trim() || null,
        is_active: isActive,
        ...(photoPath ? { photo_path: photoPath } : {}),
      });
      toast.show('Saved');
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this shop.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader back title="Edit shop" />
      <Page narrow>
        {!shop && !loadError ? <SkeletonRows count={5} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {shop ? (
          <>
            <ShopFormFields
              values={values}
              onChange={(next) => {
                setDirty(true);
                setValues(next);
              }}
            />
            <SwitchRow
              label="Active"
              value={isActive}
              onChange={(v) => {
                setDirty(true);
                setIsActive(v);
              }}
            />
            <SectionLabel>Photo</SectionLabel>
            <PhotoPicker
              file={photo}
              existingUrl={existingPhotoUrl}
              onChange={(f) => {
                setDirty(true);
                setPhoto(f);
              }}
            />
            {error ? <MessageBox tone="danger" message={error} /> : null}
            <PrimaryButton label="Save changes" onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />
          </>
        ) : null}
      </Page>
    </>
  );
}
