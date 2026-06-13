export type Product = {
  id: string;
  business_id: string;
  name: string;
  unit: string;
  unit_price: number;
  is_active: boolean;
  created_at: string;
};

export type Shop = {
  id: string;
  business_id: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  area: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
};
