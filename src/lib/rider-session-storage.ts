import { readStorage, writeStorage } from '@/lib/safe-storage';

const TOKEN_KEY = 'rider_session_token';

export async function getStoredRiderToken(): Promise<string | null> {
  return readStorage(TOKEN_KEY);
}

export async function setStoredRiderToken(token: string): Promise<void> {
  writeStorage(TOKEN_KEY, token);
}

export async function clearStoredRiderToken(): Promise<void> {
  writeStorage(TOKEN_KEY, null);
}
