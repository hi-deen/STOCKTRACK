export interface BusinessMembership {
  business_id: string;
  role: 'owner' | 'admin' | 'staff' | 'observer';
  business_name: string;
}
