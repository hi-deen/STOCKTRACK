// What a member may do in a business. The owner can always do everything;
// for Admin, Staff and Observer the owner picks from this list on the Roles
// screen. Keys match business_role_permissions.permission and every key is
// enforced by the database (see 202611060002_roles_and_permissions.sql).
export const PERMISSIONS = [
  { key: 'record_sales', label: 'Record deliveries and payments' },
  { key: 'correct_sales', label: 'Edit and correct deliveries and payments' },
  { key: 'delete_sales', label: 'Delete deliveries and payments, and change their dates' },
  { key: 'record_stock', label: 'Record purchases, production runs and expenses' },
  { key: 'manage_stock_records', label: 'Edit and delete purchases, production runs and expenses' },
  { key: 'manage_catalog', label: 'Add and edit products, stock items and expense categories' },
  { key: 'manage_shops', label: 'Add and edit shops' },
  { key: 'remove_shops', label: 'Delete shops and import shop lists' },
  { key: 'manage_riders', label: 'Manage riders and their routes' },
  { key: 'manage_settings', label: 'Change business settings' },
] as const;

export type Permission = (typeof PERMISSIONS)[number]['key'];

export type MemberRole = 'owner' | 'admin' | 'staff' | 'observer';
export type AssignableRole = Exclude<MemberRole, 'owner'>;

export const ASSIGNABLE_ROLES: AssignableRole[] = ['admin', 'staff', 'observer'];

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
  observer: 'Observer',
};

export const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  admin: 'Trusted people who help run the business.',
  staff: 'Everyday team members.',
  observer: 'Can see everything, and change only what you allow.',
};

export function roleLabel(role: string | null | undefined): string {
  return ROLE_LABELS[role as MemberRole] ?? 'Staff';
}
