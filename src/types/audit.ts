export interface AuditLogEntry {
  id: string;
  actor_type: 'owner' | 'staff' | 'rider';
  actor_label: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
