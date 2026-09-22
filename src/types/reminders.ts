export interface ReminderSuggestion {
  shop_id: string;
  shop_name: string;
  shop_phone: string | null;
  type: 'payment' | 'restock';
  reason: string;
  suggested_message: string;
}

export interface Reminder {
  id: string;
  shop_id: string | null;
  shop_name: string | null;
  type: 'payment' | 'restock' | 'custom';
  title: string;
  message: string;
  due_date: string;
  status: 'pending' | 'done' | 'dismissed';
}
