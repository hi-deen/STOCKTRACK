'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PhotoPicker } from '@/components/photo-picker';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { EMPTY_SHOP_FORM, ShopFormFields, type ShopFormValues } from '@/components/shop-form-fields';
import { useToast } from '@/components/toast';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { createShop, updateShop } from '@/lib/shops-api';
import { uploadShopPhoto } from '@/lib/upload-shop-photo';

export default function NewShopPage() {
  const router = useRouter();
  const { activeBusinessId } = useBusinessAuth();
  const toast = useToast();

  const [values, setValues] = useState<ShopFormValues>(EMPTY_SHOP_FORM);
  const [photo, setPhoto] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = values.name.trim().length > 0 && !!activeBusinessId;

  async function handleSubmit() {
    if (!canSubmit || isSubmitting || !activeBusinessId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const shop = await createShop(activeBusinessId, {
        name: values.name.trim(),
        owner_name: values.ownerName.trim() || null,
        phone: values.phone.trim() || null,
        area: values.area.trim() || null,
        address: values.address.trim() || null,
        notes: values.notes.trim() || null,
      });
      if (photo) {
        const path = await uploadShopPhoto(photo, activeBusinessId, shop.id);
        await updateShop(shop.id, { photo_path: path });
      }
      toast.show('Shop created');
      router.replace(`/shops/${shop.id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create this shop.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader back title="New shop" />
      <Page narrow>
        <ShopFormFields values={values} onChange={setValues} />
        <SectionLabel>Photo</SectionLabel>
        <PhotoPicker file={photo} onChange={setPhoto} />
        {error ? <MessageBox tone="danger" message={error} /> : null}
        <PrimaryButton label="Create shop" onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />
      </Page>
    </>
  );
}
