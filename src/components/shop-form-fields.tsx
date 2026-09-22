'use client';

import { Field, FormInput, FormTextarea } from '@/components/form-input';

export interface ShopFormValues {
  name: string;
  ownerName: string;
  phone: string;
  area: string;
  address: string;
  notes: string;
}

export const EMPTY_SHOP_FORM: ShopFormValues = {
  name: '',
  ownerName: '',
  phone: '',
  area: '',
  address: '',
  notes: '',
};

// Shared field list for the New shop and Edit shop screens.
export function ShopFormFields({
  values,
  onChange,
}: {
  values: ShopFormValues;
  onChange: (next: ShopFormValues) => void;
}) {
  const set = (key: keyof ShopFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...values, [key]: e.target.value });

  return (
    <>
      <Field label="Name">
        <FormInput value={values.name} onChange={set('name')} placeholder="e.g. Amina Stores" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner name">
          <FormInput value={values.ownerName} onChange={set('ownerName')} placeholder="Optional" />
        </Field>
        <Field label="Phone">
          <FormInput type="tel" value={values.phone} onChange={set('phone')} placeholder="Optional" />
        </Field>
        <Field label="Area">
          <FormInput value={values.area} onChange={set('area')} placeholder="Optional" />
        </Field>
        <Field label="Address">
          <FormInput value={values.address} onChange={set('address')} placeholder="Optional" />
        </Field>
      </div>
      <Field label="Notes">
        <FormTextarea value={values.notes} onChange={set('notes')} placeholder="Optional" />
      </Field>
    </>
  );
}
