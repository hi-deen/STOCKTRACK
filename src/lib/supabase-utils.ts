// PostgREST embeds a related row as an object or an array depending on how
// it infers the relationship's cardinality; normalize either shape to a
// single row (or null) so callers don't have to special-case it.
export function normalizeEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
