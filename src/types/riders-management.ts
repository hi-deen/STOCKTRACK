export interface BusinessMember {
  user_id: string;
  email: string | null;
  role: 'owner' | 'staff';
  joined_at: string;
}

export interface BusinessRiderLink {
  id: string;
  rider_id: string;
  status: 'pending' | 'active' | 'declined' | 'removed';
  requested_via: 'owner_invite' | 'rider_request';
  created_at: string;
  responded_at: string | null;
  rider_phone: string;
  rider_full_name: string;
  rider_is_active: boolean;
}

export interface RiderAssignmentRow {
  id: string;
  shop_id: string;
  shop_name: string;
  days_of_week: number[];
}

export interface BusinessSettings {
  payment_reminder_days: number;
  restock_reminder_days: number;
  business_display_name: string | null;
}
