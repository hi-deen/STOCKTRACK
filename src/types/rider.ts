export interface RiderLoginResult {
  rider_id: string;
  token: string;
  full_name: string;
}

export interface RiderHomeLink {
  link_id: string;
  business_id: string;
  business_name: string;
  status: 'pending' | 'active' | 'declined' | 'removed';
  requested_via: 'owner_invite' | 'rider_request';
  assigned_shop_count: number;
}

export interface RiderShopProduct {
  product_id: string;
  product_name: string;
  unit: string;
  unit_price: number;
  usual_quantity: number | null;
}

export interface RiderRouteStop {
  business_id: string;
  business_name: string;
  shop_id: string;
  shop_name: string;
  area: string | null;
  address: string | null;
  phone: string | null;
  photo_path: string | null;
  usual_order_summary: string | null;
  restocked_today: boolean;
  today_delivery_summary: string | null;
}
