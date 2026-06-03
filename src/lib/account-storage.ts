export function buildAccountStorageKey(baseKey: string, userId?: string | null) {
  return userId ? `${baseKey}:${userId}` : `${baseKey}:guest`;
}
