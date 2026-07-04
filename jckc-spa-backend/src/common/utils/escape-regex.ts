/**
 * Escapes regex metacharacters so user-supplied search text can be used
 * safely inside a MongoDB `$regex` (fixes the legacy injection/crash
 * quirk — students.md Q6).
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
