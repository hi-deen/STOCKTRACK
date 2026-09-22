// Deliberately does not use `err instanceof Error`. Supabase's
// PostgrestError is declared as `class PostgrestError extends Error` in
// its TypeScript source, but that alone doesn't guarantee `instanceof`
// works at runtime — compiling a built-in subclass without an explicit
// `Object.setPrototypeOf` fixup (which its constructor doesn't have) can
// break the prototype chain depending on the target/bundler, silently
// failing `instanceof Error` for a completely genuine error. Duck-typing
// on `.message` works regardless of whether that's happening.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return fallback;
}
