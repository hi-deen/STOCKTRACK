import { readStorage, writeStorage } from '@/lib/safe-storage';

const ACTIVE_BUSINESS_KEY = 'stocktrack.activeBusinessId';

export async function getStoredActiveBusinessId(): Promise<string | null> {
  return readStorage(ACTIVE_BUSINESS_KEY);
}

export async function setStoredActiveBusinessId(id: string): Promise<void> {
  writeStorage(ACTIVE_BUSINESS_KEY, id);
}
