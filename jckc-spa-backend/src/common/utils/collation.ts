/**
 * The single case-insensitive sort collation used by every name-ordered
 * list query (DESIGN.md decision 8 — fixes the legacy byte-order sorts).
 */
export const CI_COLLATION = { locale: 'en', strength: 2 } as const;
