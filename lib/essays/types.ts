/**
 * Essay type vocabulary and the shared word-count rule.
 *
 * Stored lowercase (the check constraint in migration 014 allows only these
 * four), displayed capitalized.
 */

export const ESSAY_TYPES = [
  { value: 'common_app', label: 'Common App' },
  { value: 'supplemental', label: 'Supplemental' },
  { value: 'scholarship', label: 'Scholarship' },
  { value: 'other', label: 'Other' },
] as const

export type EssayType = (typeof ESSAY_TYPES)[number]['value']

export const DEFAULT_ESSAY_TYPE: EssayType = 'common_app'

export function isEssayType(value: string): value is EssayType {
  return ESSAY_TYPES.some((type) => type.value === value)
}

/** Falls back to the raw value rather than throwing, so an unknown type still renders. */
export function essayTypeLabel(value: string): string {
  return ESSAY_TYPES.find((type) => type.value === value)?.label ?? value
}

/**
 * Word count derived from the editor's HTML, server-side.
 *
 * The client could send a count, but it is the thing counted against an
 * application's limit, so it is recomputed from the stored content rather than
 * trusted. Tags become spaces (so "</p><p>" does not glue two words together),
 * then entities are neutralised and runs of whitespace collapsed.
 */
export function countWords(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, '')
    .trim()

  if (!text) {
    return 0
  }

  return text.split(/\s+/).length
}
