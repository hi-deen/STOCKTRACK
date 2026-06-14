export type Reminder = {
  id: string;
  business_id: string;
  shop_id: string;
  type: "payment" | "restock" | "custom";
  title: string;
  message: string;
  due_date: string;
  status: "pending" | "done" | "dismissed";
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  shop_name?: string;
  shop_phone?: string | null;
};

export type ReminderSuggestion = {
  shop_id: string;
  shop_name: string;
  shop_phone: string | null;
  type: "payment" | "restock";
  reason: string;
  suggested_message: string;
};
