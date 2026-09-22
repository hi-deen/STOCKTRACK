import { readStorage, writeStorage } from '@/lib/safe-storage';

// Per screen AND business, so Operations and Shops keep independent collapse
// preferences and area names never leak across businesses.
function storageKey(screenKey: string, businessId: string): string {
  return `${screenKey}_collapsed_areas_${businessId}`;
}

export async function getCollapsedAreas(screenKey: string, businessId: string): Promise<string[]> {
  try {
    const raw = readStorage(storageKey(screenKey, businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function setCollapsedAreas(
  screenKey: string,
  businessId: string,
  areas: string[]
): Promise<void> {
  writeStorage(storageKey(screenKey, businessId), JSON.stringify(areas));
}
